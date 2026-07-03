import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import axios from "axios";
import https from "https";
import NodeCache from "node-cache";
import dotenv from "dotenv";
import fs from "fs";

// Models
import User from "./models/User.js";
import Payment from "./models/paymentModel.js";

import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from multiple potential locations
const envPaths = [
  join(__dirname, ".env"), // src/server/.env
  join(__dirname, "..", ".env"), // src/.env
  join(__dirname, "..", "..", ".env"), // root/.env
  join(process.cwd(), ".env"), // current working directory
];

console.log("Searching for .env files...");
envPaths.forEach((path) => {
  if (fs.existsSync(path)) {
    console.log(`Loading .env from: ${path}`);
    dotenv.config({ path });
  }
});

dotenv.config(); // Fallback to default behavior

console.log("--- DEBUG: ENVIRONMENT VARIABLES ---");
console.log("CWD:", process.cwd());
console.log("__dirname:", __dirname);
console.log(
  "MPESA_KEY:",
  process.env.MPESA_CONSUMER_KEY ? "Loaded" : "Missing",
);
console.log(
  "MPESA_SECRET:",
  process.env.MPESA_CONSUMER_SECRET ? "Loaded" : "Missing",
);
console.log("------------------------------------");

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3500;

// Force MONGODB_URI to use 'mpesa' database as requested
let MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/mpesa";
if (MONGODB_URI.includes("react_login")) {
  console.log("Overriding react_login with mpesa in connection string");
  MONGODB_URI = MONGODB_URI.replace("react_login", "mpesa");
}

console.log(`Final MongoDB URI being used: ${MONGODB_URI}`);

const JWT_SECRET =
  process.env.JWT_SECRET || "mock-secret-change-this-in-production";

// SAP Configuration
const SAP_CONFIG = {
  BASE_URL: process.env.SAP_BASE_URL || "https://kelvin:50000/b1s/v2",
  COMPANY_DB: process.env.SAP_COMPANY_DB || "SBODemoUS",
  USERNAME: process.env.SAP_USERNAME || "manager",
  PASSWORD: process.env.SAP_PASSWORD || "Password",
  // Default to false (allow self-signed) for development, true for production
  SSL_REJECT_UNAUTHORIZED: process.env.SAP_SSL_REJECT_UNAUTHORIZED === "true",
  CONNECTION_TIMEOUT: parseInt(process.env.SAP_TIMEOUT) || 90000,
  NODE_ENV: process.env.NODE_ENV || "development",
};

// Initialize cache (TTL: 5 minutes, check period: 1 minute)
const cache = new NodeCache({
  stdTTL: 300,
  checkperiod: 60,
});

// Create optimized axios instance for SAP
const sapAxios = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: SAP_CONFIG.SSL_REJECT_UNAUTHORIZED,
    keepAlive: true,
    maxSockets: 50,
    keepAliveMsecs: 1000,
    timeout: SAP_CONFIG.CONNECTION_TIMEOUT,
  }),
  timeout: SAP_CONFIG.CONNECTION_TIMEOUT,
  maxRedirects: 0,
  httpAgent: new https.Agent({
    keepAlive: true,
  }),
});

if (
  !SAP_CONFIG.SSL_REJECT_UNAUTHORIZED &&
  SAP_CONFIG.NODE_ENV === "development"
) {
  console.log(
    "SSL certificate verification disabled for SAP (development mode)",
  );
}

// ====================
// SAP SESSION MANAGER
// ====================

class SAPSessionManager {
  constructor() {
    this.sessionToken = null;
    this.sessionCookie = null;
    this.sessionExpiry = null;
    this.appInstanceId = Date.now().toString(36);
    this.isSessionActive = false;
  }

  // Get current session status
  getSessionInfo() {
    return {
      isActive: this.isSessionActive,
      token: this.sessionToken
        ? `${this.sessionToken.substring(0, 20)}...`
        : null,
      expiresAt: this.sessionExpiry,
      appInstanceId: this.appInstanceId,
      timeToExpiry: this.sessionExpiry
        ? Math.max(0, this.sessionExpiry - Date.now()) / 1000
        : 0,
    };
  }

  // Check if session is valid
  isValid() {
    return (
      this.isSessionActive &&
      this.sessionToken &&
      this.sessionExpiry &&
      Date.now() < this.sessionExpiry
    );
  }

  // Clear session without calling SAP logout
  clearSession() {
    this.sessionToken = null;
    this.sessionCookie = null;
    this.sessionExpiry = null;
    this.isSessionActive = false;
    console.log("SAP session cleared from memory");
  }

  // Logout from SAP (invalidate session)
  async logoutFromSAP() {
    if (!this.isSessionActive || !this.sessionToken) {
      console.log("No active SAP session to logout");
      return;
    }

    try {
      console.log("Logging out from SAP...");

      await sapAxios.post(
        `${SAP_CONFIG.BASE_URL}/Logout`,
        {},
        {
          headers: {
            Cookie: this.sessionCookie || `B1SESSION=${this.sessionToken}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
      );

      console.log("Successfully logged out from SAP");
    } catch (error) {
      console.warn(
        "SAP logout failed (session may have already expired):",
        error.message,
      );
    } finally {
      // Always clear the local session
      this.clearSession();
    }
  }

  // Login to SAP
  async loginToSAP(retryCount = 0) {
    const maxRetries = 2;

    try {
      console.log(
        `SAP Login attempt ${retryCount + 1} to ${SAP_CONFIG.BASE_URL}`,
      );

      const response = await sapAxios.post(
        `${SAP_CONFIG.BASE_URL}/Login`,
        {
          CompanyDB: SAP_CONFIG.COMPANY_DB,
          UserName: SAP_CONFIG.USERNAME,
          Password: SAP_CONFIG.PASSWORD,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
      );

      this.sessionToken = response.data.SessionId;
      this.sessionCookie = `B1SESSION=${this.sessionToken}`;
      this.sessionExpiry = Date.now() + 30 * 60 * 1000; // 30 minutes
      this.isSessionActive = true;

      console.log("SAP Login successful");
      return this.sessionToken;
    } catch (error) {
      console.error(
        `SAP Login attempt ${retryCount + 1} failed:`,
        error.message,
      );

      if (retryCount < maxRetries) {
        console.log(`Retrying SAP login in 2 seconds...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return this.loginToSAP(retryCount + 1);
      }

      this.clearSession();
      throw error;
    }
  }

  // Ensure valid SAP session
  async ensureValidSession() {
    if (!this.isValid()) {
      console.log("SAP Session expired or missing, logging in...");
      await this.loginToSAP();
    }
    return this.sessionToken;
  }

  // Invalidate session on app restart
  invalidateOnRestart() {
    this.appInstanceId = Date.now().toString(36);
    this.clearSession();
    console.log(
      `SAP session invalidated for new app instance: ${this.appInstanceId}`,
    );
  }
}

// Initialize SAP Session Manager
const sapSessionManager = new SAPSessionManager();

// ====================
// AUTH TOKEN MANAGER
// ====================

class AuthTokenManager {
  constructor() {
    this.appStartTime = Date.now();
    this.appInstanceId = this.appStartTime.toString(36);
    this.blacklistedTokens = new Set();
  }

  generateToken(payload) {
    const tokenPayload = {
      ...payload,
      appInstanceId: this.appInstanceId,
      iat: Math.floor(Date.now() / 1000),
    };

    return jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: "1h",
    });
  }

  verifyToken(token) {
    try {
      if (this.blacklistedTokens.has(token)) {
        console.log("Token is blacklisted");
        return null;
      }

      const decoded = jwt.verify(token, JWT_SECRET);

      if (decoded.appInstanceId !== this.appInstanceId) {
        console.log("Token issued by different app instance");
        return null;
      }

      return decoded;
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        console.log("Token has expired");
      } else if (error.name === "JsonWebTokenError") {
        console.log("Invalid token");
      }
      return null;
    }
  }

  blacklistToken(token) {
    try {
      const decoded = jwt.decode(token);
      if (!decoded) return false;

      this.blacklistedTokens.add(token);

      const expiresIn = decoded.exp * 1000 - Date.now();
      if (expiresIn > 0) {
        setTimeout(() => {
          this.blacklistedTokens.delete(token);
        }, expiresIn);
      }

      console.log("Token blacklisted");
      return true;
    } catch (error) {
      console.error("Error blacklisting token:", error.message);
      return false;
    }
  }

  clearBlacklist() {
    this.blacklistedTokens.clear();
    console.log("Token blacklist cleared");
  }

  getAppInstanceInfo() {
    return {
      id: this.appInstanceId,
      startedAt: new Date(this.appStartTime).toISOString(),
      blacklistedTokensCount: this.blacklistedTokens.size,
    };
  }

  // Invalidate all tokens on app restart
  invalidateOnRestart() {
    this.appInstanceId = Date.now().toString(36);
    this.clearBlacklist();
    console.log(
      `Auth tokens invalidated for new app instance: ${this.appInstanceId}`,
    );
  }
}

// Initialize Token Manager
const authTokenManager = new AuthTokenManager();

// ====================
// MIDDLEWARE
// ====================

// CORS Configuration
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8080",
      ];

      if (allowedOrigins.indexOf(origin) === -1) {
        const msg =
          "The CORS policy for this site does not allow access from the specified Origin.";
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`,
    );
  });
  next();
});

// Connect to MongoDB
mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// ====================
// AUTH MIDDLEWARE
// ====================

const verifyAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = authTokenManager.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    if (!decoded.roles.includes("Admin")) {
      return res.status(403).json({ message: "Admin access required" });
    }

    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

const verifyAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = authTokenManager.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

const verifyLogout = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(400).json({ message: "No token provided" });

  try {
    const decoded = jwt.decode(token);
    if (!decoded) {
      return res.status(400).json({ message: "Invalid token format" });
    }

    req.tokenToBlacklist = token;
    next();
  } catch (e) {
    return res.status(400).json({ message: "Invalid token" });
  }
};

// Middleware to ensure SAP token
const ensureSAPToken = async (req, res, next) => {
  try {
    await sapSessionManager.ensureValidSession();
    next();
  } catch (error) {
    console.error("Failed to establish SAP session");
    return res.status(503).json({
      error: "SAP Service unavailable",
      details: error.response?.data?.error?.message || error.message,
      code: error.code,
    });
  }
};

// ====================
// CACHE MANAGEMENT
// ====================

// Cache key generator for SAP requests
const getCacheKey = (endpoint, params) => {
  return `sap:${endpoint}:${JSON.stringify(params)}`;
};

// Optimized SAP request with caching
const makeSAPRequest = async (
  method,
  endpoint,
  params = {},
  data = null,
  bypassCache = false,
) => {
  const cacheKey = getCacheKey(endpoint, params);

  // Try cache first for GET requests
  if (method === "GET" && !bypassCache) {
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log(`Cache hit for ${endpoint}`);
      return cached;
    }
  }

  try {
    const config = {
      method,
      url: `${SAP_CONFIG.BASE_URL}${endpoint}`,
      headers: {
        Cookie:
          sapSessionManager.sessionCookie ||
          `B1SESSION=${sapSessionManager.sessionToken}`,
        "Content-Type": "application/json",
        Prefer: "odata.maxpagesize=1000",
      },
      params: method === "GET" ? params : undefined,
      data: method !== "GET" ? data : undefined,
      timeout: SAP_CONFIG.CONNECTION_TIMEOUT,
    };

    console.log(`🚀 SAP ${method} ${endpoint}`);
    const startTime = Date.now();

    const response = await sapAxios(config);

    const duration = Date.now() - startTime;
    console.log(`SAP ${method} ${endpoint} completed in ${duration}ms`);

    // Cache GET responses
    if (method === "GET" && response.data) {
      cache.set(cacheKey, response.data);
    }

    return response.data;
  } catch (error) {
    console.error(`SAP ${method} ${endpoint} failed:`, error.message);

    // Clear cache for this endpoint on error
    cache.del(cacheKey);

    // Handle session expiration
    if (error.response?.status === 401 || error.response?.status === 440) {
      console.log("SAP Session expired, clearing token");
      sapSessionManager.clearSession();
    }

    throw error;
  }
};

// Optimized SAP error handler
const handleSAPError = (error, req, res, endpoint) => {
  console.error(`SAP Error at ${endpoint}:`, error.message);

  if (error.code === "ECONNABORTED") {
    return res.status(504).json({
      success: false,
      error: "SAP request timeout",
      details:
        "The request to SAP took too long. Try reducing the search scope.",
      endpoint,
      suggestion: "Try with a more specific search query",
    });
  }

  if (error.code === "ECONNREFUSED") {
    return res.status(503).json({
      success: false,
      error: "SAP Service Layer unavailable",
      details: "Cannot connect to SAP. Check if the service is running.",
      endpoint,
    });
  }

  if (error.response) {
    return res.status(error.response.status).json({
      success: false,
      error: `SAP API error at ${endpoint}`,
      details: error.response.data?.error?.message || error.response.data,
      sapCode: error.response.data?.error?.code,
      endpoint,
    });
  }

  return res.status(500).json({
    success: false,
    error: "SAP request failed",
    details: error.message,
    endpoint,
  });
};

// ====================
// AUTHENTICATION ROUTES - FIXED VERSION
// ====================

// Register - FIXED VERSION
app.post("/register", async (req, res) => {
  try {
    const { user, pwd } = req.body;
    if (!user || !pwd) {
      return res
        .status(400)
        .json({ message: "Username and password required" });
    }

    // Check if username already exists
    const existing = await User.findOne({ user });
    if (existing) {
      return res.status(409).json({ message: "Username already taken" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(pwd, 10);

    // Create new user
    const newUser = new User({
      user,
      password: hashedPassword,
      roles: ["User"],
    });

    await newUser.save();

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
    });
  } catch (e) {
    console.error("Registration error:", e);
    return res.status(500).json({
      success: false,
      message: "Server error during registration",
    });
  }
});

// Login - FIXED VERSION with better error handling
app.post("/auth", async (req, res) => {
  try {
    const { user, pwd } = req.body;

    // Input validation
    if (!user || !pwd) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    console.log(`Login attempt for user: ${user}`);

    // Find user in database
    const found = await User.findOne({ user });

    if (!found) {
      console.log(`User not found: ${user}`);
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    console.log(`User found: ${found.user}`);
    console.log(`Stored password hash: ${found.password.substring(0, 20)}...`);

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(pwd, found.password);

    if (!isPasswordValid) {
      console.log(`Password mismatch for user: ${user}`);
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    console.log(`Password valid for user: ${user}`);

    // Generate JWT token
    const accessToken = authTokenManager.generateToken({
      user: found.user,
      roles: found.roles,
    });

    console.log(`Login successful for user: ${user}, roles: ${found.roles}`);

    return res.json({
      success: true,
      accessToken,
      roles: found.roles,
      user: found.user,
      message: "Login successful",
      appInstanceInfo: authTokenManager.getAppInstanceInfo(),
    });
  } catch (e) {
    console.error("Login error:", e);
    return res.status(500).json({
      success: false,
      message: "Server error during login",
      error: e.message,
    });
  }
});

// Test endpoint to check database users
app.get("/auth/test-users", async (req, res) => {
  try {
    const users = await User.find({}, "user roles createdAt");
    console.log("Current users in database:", users);

    res.json({
      success: true,
      users: users.map((u) => ({
        username: u.user,
        roles: u.roles,
        created: u.createdAt,
      })),
    });
  } catch (e) {
    console.error("Error fetching users:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Logout - invalidates BOTH app auth token AND SAP session
app.post("/logout", verifyLogout, async (req, res) => {
  try {
    const token = req.tokenToBlacklist;

    // Invalidate app auth token
    const tokenSuccess = authTokenManager.blacklistToken(token);

    // Invalidate SAP session
    await sapSessionManager.logoutFromSAP();

    // Clear SAP cache
    cache.flushAll();
    console.log("SAP cache cleared");

    if (tokenSuccess) {
      res.json({
        success: true,
        message:
          "Successfully logged out. Both app and SAP sessions have been invalidated.",
        appInstanceInfo: authTokenManager.getAppInstanceInfo(),
        sapSessionInfo: sapSessionManager.getSessionInfo(),
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to logout. Please try again.",
      });
    }
  } catch (e) {
    console.error("Logout error:", e);
    res.status(500).json({
      success: false,
      message: "Server error during logout",
    });
  }
});

// Validate token
app.post("/validate-token", (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: "No token provided",
      });
    }

    const decoded = authTokenManager.verifyToken(token);
    if (decoded) {
      res.json({
        success: true,
        valid: true,
        user: decoded.user,
        roles: decoded.roles,
        expiresIn: decoded.exp - Math.floor(Date.now() / 1000),
        appInstanceInfo: authTokenManager.getAppInstanceInfo(),
      });
    } else {
      res.json({
        success: true,
        valid: false,
        message: "Token is invalid or expired",
      });
    }
  } catch (e) {
    console.error("Validate token error:", e);
    res.status(500).json({
      success: false,
      valid: false,
      message: "Server error",
    });
  }
});

// App instance info
app.get("/auth/info", (req, res) => {
  res.json({
    success: true,
    appInstanceInfo: authTokenManager.getAppInstanceInfo(),
    sapSessionInfo: sapSessionManager.getSessionInfo(),
    cacheStats: cache.getStats(),
    note: "All tokens will be invalid when the app restarts",
  });
});

// ====================
// SAP MANAGEMENT ROUTES
// ====================

// SAP Login endpoint with diagnostics
app.post("/api/sap/login", verifyAuth, async (req, res) => {
  try {
    console.log("Testing SAP connectivity...");
    const startTime = Date.now();

    // Test connection first
    try {
      await sapAxios.get(`${SAP_CONFIG.BASE_URL}/`, { timeout: 5000 });
    } catch (testError) {
      console.error("SAP connectivity test failed:", testError.message);
      return res.status(503).json({
        success: false,
        error: "SAP Service Layer not reachable",
        details: testError.message,
        suggestion: "Check if SAP Service Layer is running and accessible",
      });
    }

    const token = await sapSessionManager.loginToSAP();
    const duration = Date.now() - startTime;

    res.json({
      success: true,
      token: token.substring(0, 20) + "...",
      message: `SAP login successful in ${duration}ms`,
      duration,
      sessionInfo: sapSessionManager.getSessionInfo(),
    });
  } catch (error) {
    console.error("SAP login failed:", error.message);

    let statusCode = 500;
    let errorMessage = "SAP login failed";

    if (error.code === "ECONNREFUSED") {
      statusCode = 503;
      errorMessage = "SAP Service Layer is not accessible";
    } else if (error.code && error.code.includes("CERT")) {
      statusCode = 495;
      errorMessage = "SSL Certificate verification failed";
    } else if (error.response?.status === 401) {
      statusCode = 401;
      errorMessage = "Invalid SAP credentials";
    } else if (error.code === "ECONNABORTED") {
      statusCode = 504;
      errorMessage = "SAP login timeout";
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: error.response?.data || error.message,
      code: error.code,
    });
  }
});

// SAP Logout endpoint
app.post("/api/sap/logout", verifyAuth, async (req, res) => {
  try {
    await sapSessionManager.logoutFromSAP();

    // Clear SAP cache
    cache.flushAll();

    res.json({
      success: true,
      message: "SAP session logged out successfully",
      sessionInfo: sapSessionManager.getSessionInfo(),
    });
  } catch (error) {
    console.error("SAP logout failed:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to logout from SAP",
      details: error.message,
    });
  }
});

// Get SAP session status
app.get("/api/sap/session", verifyAuth, (req, res) => {
  res.json({
    success: true,
    sessionInfo: sapSessionManager.getSessionInfo(),
    cacheItems: cache.getStats().keys,
  });
});

// ====================
// OPTIMIZED SAP DATA ROUTES
// ====================

// Get SAP Business Partners
app.get(
  "/api/sap/business-partners",
  verifyAuth,
  ensureSAPToken,
  async (req, res) => {
    try {
      const {
        search,
        cardType = "cCustomer",
        limit = 100,
        skip = 0,
        simple = "false",
      } = req.query;
      const isSimple = simple === "true";

      console.log(
        `🔍 Fetching business partners with search: "${search}", limit: ${limit}`,
      );

      // Build optimized query parameters
      const params = {
        $select: isSimple
          ? "CardCode,CardName"
          : "CardCode,CardName,Phone1,Cellular,EmailAddress,Address,Currency",
        $orderby: "CardName asc",
        $top: Math.min(500, parseInt(limit)),
      };

      let filter = `CardType eq '${cardType}'`;

      if (search && search.trim().length > 0) {
        const searchTerm = search.trim();

        if (/^\d+$/.test(searchTerm) || /^[A-Za-z]\d+$/i.test(searchTerm)) {
          filter += ` and startswith(CardCode, '${searchTerm}')`;
        } else {
          filter += ` and (contains(tolower(CardName), tolower('${searchTerm}'))`;
          filter += ` or startswith(Phone1, '${searchTerm}')`;
          filter += ` or startswith(Cellular, '${searchTerm}'))`;
        }

        if (searchTerm.length < 3) {
          params.$top = Math.min(50, parseInt(limit));
        }
      }

      params.$filter = filter;

      if (parseInt(skip) > 0) {
        params.$skip = parseInt(skip);
      }

      const startTime = Date.now();
      const data = await makeSAPRequest(
        "GET",
        "/BusinessPartners",
        params,
        null,
        true,
      );
      const duration = Date.now() - startTime;

      console.log(
        `Fetched ${data.value?.length || 0} business partners in ${duration}ms`,
      );

      res.json({
        success: true,
        count: data.value?.length || 0,
        data: data.value || [],
        duration,
        cached: false,
        query: { search, limit, cardType },
      });
    } catch (error) {
      console.error("Business partners API error:", error.message);
      handleSAPError(error, req, res, "BusinessPartners");
    }
  },
);

// Get specific business partner
app.get(
  "/api/sap/business-partners/:cardCode",
  verifyAuth,
  ensureSAPToken,
  async (req, res) => {
    try {
      const { cardCode } = req.params;
      console.log(`Fetching business partner: ${cardCode}`);

      const startTime = Date.now();
      const data = await makeSAPRequest(
        "GET",
        `/BusinessPartners('${cardCode}')`,
        {
          $select:
            "CardCode,CardName,Phone1,Cellular,EmailAddress,Address,Currency,PaymentTerms,PriceListNum,Balance,ContactEmployees",
        },
        null,
        true,
      );

      const duration = Date.now() - startTime;
      console.log(`Fetched business partner ${cardCode} in ${duration}ms`);

      res.json({
        success: true,
        data,
        duration,
      });
    } catch (error) {
      console.error("Business partner detail error:", error.message);
      handleSAPError(
        error,
        req,
        res,
        `BusinessPartners('${req.params.cardCode}')`,
      );
    }
  },
);

// Get invoices
app.get("/api/sap/invoices", verifyAuth, ensureSAPToken, async (req, res) => {
  try {
    const { cardCode, limit = 1000 } = req.query;

    if (!cardCode) {
      return res.status(400).json({
        success: false,
        error: "CardCode is required.",
      });
    }

    console.log(`Fetching all open invoices for customer: ${cardCode}`);

    const params = {
      $select:
        "CardCode,DocEntry,DocNum,DocTotal,DocDate,DocDueDate,DocumentStatus,CardName,PaidToDate",
      $orderby: "DocDueDate asc",
      $top: Math.min(1000, parseInt(limit)),
      $filter: `DocumentStatus eq 'O' and CardCode eq '${cardCode}'`,
    };

    const startTime = Date.now();
    const data = await makeSAPRequest("GET", "/Invoices", params, null, true);
    const duration = Date.now() - startTime;

    const invoices = data.value || [];
    console.log(`Fetched ${invoices.length} invoices in ${duration}ms`);

    const processedInvoices = invoices.map((inv) => ({
      ...inv,
      RemainingAmount: inv.DocTotal - (inv.PaidToDate || 0),
    }));

    res.json({
      success: true,
      count: invoices.length,
      data: processedInvoices,
      duration,
    });
  } catch (error) {
    console.error("Invoices API error:", error.message);
    handleSAPError(error, req, res, "Invoices");
  }
});

// ====================
// ADMIN ROUTES
// ====================

// Get all users
app.get("/admin/users", verifyAdmin, async (req, res) => {
  try {
    const users = await User.find({}, "-password");
    return res.json({
      success: true,
      data: users,
    });
  } catch (e) {
    console.error("Get users error:", e);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

// Promote user
app.post("/admin/promote", verifyAdmin, async (req, res) => {
  try {
    const { targetUser } = req.body;
    if (!targetUser) {
      return res.status(400).json({
        success: false,
        message: "Target user required",
      });
    }

    const user = await User.findOne({ user: targetUser });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.roles.includes("Admin")) {
      user.roles.push("Admin");
      await user.save();
    }

    return res.json({
      success: true,
      message: "User promoted to admin",
      user: {
        username: user.user,
        roles: user.roles,
      },
    });
  } catch (e) {
    console.error("Promote error:", e);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

// ====================
// PAYMENT ROUTES
// ====================

// List payments
app.get("/admin/payments", verifyAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit || "10", 10)),
    );
    const q = (req.query.q || "").trim();
    const status = req.query.status;
    const min = parseFloat(req.query.min) || null;
    const max = parseFloat(req.query.max) || null;

    const filter = {};

    if (q) {
      filter.$or = [
        { number: { $regex: q, $options: "i" } },
        { trnx_id: { $regex: q, $options: "i" } },
      ];
    }

    if (status) {
      if (status.startsWith("not:")) {
        filter.status = { $ne: status.split(":")[1] };
      } else if (status.includes(",")) {
        filter.status = { $in: status.split(",") };
      } else {
        filter.status = status;
      }
    }

    if (min !== null || max !== null) {
      filter.amount = {};
      if (min !== null) filter.amount.$gte = min;
      if (max !== null) filter.amount.$lte = max;
    }

    const skip = (page - 1) * limit;
    const noPagination = req.query.nopagination === "true";

    const [total, payments] = await Promise.all([
      Payment.countDocuments(filter),
      noPagination
        ? Payment.find(filter)
            .select("-raw -__v")
            .sort({ createdAt: -1 })
            .lean()
        : Payment.find(filter)
            .select("-raw -__v")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
    ]);

    return res.json({
      success: true,
      data: payments,
      total,
      page,
      pageSize: limit,
    });
  } catch (e) {
    console.error("Get payments error:", e);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

// Get single payment
app.get("/admin/payments/:id", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment ID format",
      });
    }
    const payment = await Payment.findById(id).select("-raw -__v").lean();
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }
    return res.json({
      success: true,
      data: payment,
    });
  } catch (e) {
    console.error("Get payment error:", e);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
});

// Update payment
app.patch("/admin/payments/:id", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: "Invalid payment ID format",
      });
    }

    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: "Payment not found",
      });
    }

    Object.keys(updateData).forEach((key) => {
      if (key.startsWith("sap") || ["status", "notes"].includes(key)) {
        payment[key] = updateData[key];
      }
    });

    payment.updatedAt = new Date();
    await payment.save();

    res.json({
      success: true,
      message: "Payment updated",
      data: payment,
    });
  } catch (e) {
    console.error("Update payment error:", e);
    res.status(500).json({
      success: false,
      error: "Server Error",
      details: e.message,
    });
  }
});
// ====================
// SAP INCOMING PAYMENTS
// ====================

app.post(
  "/api/sap/incoming-payments",
  verifyAdmin,
  ensureSAPToken,
  async (req, res) => {
    try {
      const {
        paymentId,
        cardCode,
        amount,
        docDate,
        docCurrency = "KES",
        invoiceEntries,
        remarks,
        // Added metadata fields for atomic confirmation
        sapCustomerName,
        sapInvoiceDocEntry,
        sapInvoiceNumber,
        sapInvoiceTotal,
        paymentMethod,
        transactionId,
      } = req.body;

      // Validate required fields
      if (!cardCode || !amount) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: cardCode and amount are required",
        });
      }

      // Use dynamic date
      const paymentDate = docDate || new Date().toISOString().split("T")[0];
      const cashSum = parseFloat(amount).toFixed(2);

      // Build SAP incoming payment document
      const incomingPayment = {
        CardCode: cardCode,
        DocDate: paymentDate,
        TaxDate: paymentDate,
        DueDate: paymentDate,
        CashSum: parseFloat(cashSum),
        Remarks: remarks || "M-Pesa payment received",
      };

      // Add invoice payments if specified
      if (
        invoiceEntries &&
        Array.isArray(invoiceEntries) &&
        invoiceEntries.length > 0
      ) {
        incomingPayment.PaymentInvoices = invoiceEntries.map((inv) => ({
          DocEntry: parseInt(inv.DocEntry),
          InvoiceType: inv.InvoiceType || "it_Invoice",
          SumApplied: parseFloat(inv.SumApplied || amount),
        }));
      }

      // Make API call to SAP
      const response = await sapAxios.post(
        `${SAP_CONFIG.BASE_URL}/IncomingPayments`,
        incomingPayment,
        {
          headers: {
            Cookie:
              sapSessionManager.sessionCookie ||
              `B1SESSION=${sapSessionManager.sessionToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      // AUTO-MARK PAYMENT AS PAID IF paymentId PROVIDED
      let paymentUpdated = false;
      let updatedPayment = null;

      if (paymentId) {
        try {
          // Find and update the payment
          const payment = await Payment.findById(paymentId);
          if (payment) {
            // Atomic confirmation data
            payment.sapConfirmed = true;
            payment.sapConfirmedAt = new Date();
            payment.sapCustomerCode = cardCode;
            payment.sapCustomerName = sapCustomerName || "";
            payment.sapInvoiceDocEntry = sapInvoiceDocEntry;
            payment.sapInvoiceNumber = sapInvoiceNumber;
            payment.sapInvoiceTotal = sapInvoiceTotal;
            payment.confirmedAmount = parseFloat(amount);
            payment.confirmedBy = req.user.user;
            payment.paymentMethod = paymentMethod || "M-Pesa";
            if (transactionId) payment.trnx_id = transactionId;

            // Updated status
            payment.status = "paid";
            payment.sapStatus = "processed";
            payment.sapDocEntry = response.data.DocEntry;
            payment.sapDocNum = response.data.DocNum;
            payment.sapPaymentCreated = true;
            payment.sapPaymentCreatedAt = new Date();
            payment.sapPaymentData = response.data;
            payment.updatedAt = new Date();
            payment.notes =
              remarks || `SAP Payment created: DocNum ${response.data.DocNum}`;

            // Add to history
            payment.paymentHistory = payment.paymentHistory || [];
            payment.paymentHistory.push({
              action: "sap_payment_created",
              at: new Date(),
              by: req.user.user,
              sapDocNum: response.data.DocNum,
              sapDocEntry: response.data.DocEntry,
              notes:
                "Payment automatically confirmed and marked as paid after SAP incoming payment creation",
            });

            // Add to confirmation history as well
            payment.confirmationHistory = payment.confirmationHistory || [];
            payment.confirmationHistory.push({
              confirmedAt: new Date(),
              confirmedBy: req.user.user,
              customerCode: cardCode,
              customerName: sapCustomerName || "",
              invoiceNumber: sapInvoiceNumber,
              amount: parseFloat(amount),
              notes: remarks,
            });

            await payment.save();
            paymentUpdated = true;
            updatedPayment = payment;
          }
        } catch (dbError) {
          console.error("Error updating payment status:", dbError.message);
        }
      }

      res.json({
        success: true,
        message: "Incoming payment created successfully",
        data: response.data,
        sapDocNum: response.data.DocNum,
        sapDocEntry: response.data.DocEntry,
        paymentUpdated: paymentUpdated,
        updatedPayment: updatedPayment,
      });
    } catch (error) {
      console.error("SAP Error:", error.message);

      if (error.response) {
        let sapErrorMessage = "Unknown SAP error";
        if (error.response.data.error) {
          const sapError = error.response.data.error;
          sapErrorMessage =
            sapError.message?.value ||
            sapError.message ||
            JSON.stringify(sapError);
        }

        res.status(400).json({
          success: false,
          error: `SAP rejected the request: ${sapErrorMessage}`,
          details: error.response.data,
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Network error connecting to SAP",
          details: error.message,
        });
      }
    }
  },
);

// ====================
// MPESA ROUTES
// ====================

app.get("/token", async (req, res) => {
  await generateToken(req, res, () => {
    res.status(200).json({ access_token: req.token });
  });
});

const generateToken = async (req, res, next) => {
  const secret = process.env.MPESA_CONSUMER_SECRET;
  const consumer = process.env.MPESA_CONSUMER_KEY;

  const auth = new Buffer.from(`${consumer}:${secret}`).toString("base64");
  await axios
    .get(
      "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
      {
        headers: {
          authorization: `Basic ${auth}`,
        },
        timeout: 10000,
      },
    )
    .then((response) => {
      req.token = response.data.access_token;
      next();
    })
    .catch((err) => {
      console.log(err);
      res.status(400).json({
        success: false,
        error: err.message,
      });
    });
};

// STK Push Endpoint
app.post("/stk", generateToken, async (req, res) => {
  try {
    const { phone, amount } = req.body;

    if (!phone || !amount) {
      return res.status(400).json({
        success: false,
        error: "Phone and amount are required",
      });
    }

    let mpesaPhone = phone.toString().replace(/\D/g, "");

    if (mpesaPhone.startsWith("0")) {
      mpesaPhone = "254" + mpesaPhone.substring(1);
    } else if (mpesaPhone.length === 9) {
      mpesaPhone = "254" + mpesaPhone;
    } else if (mpesaPhone.startsWith("+254")) {
      mpesaPhone = mpesaPhone.substring(1);
    }

    if (!/^254\d{9}$/.test(mpesaPhone)) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid Kenyan phone number format. Use 07XXXXXXXX or 2547XXXXXXXX",
      });
    }

    const date = new Date();
    const timestamp =
      date.getFullYear() +
      ("0" + (date.getMonth() + 1)).slice(-2) +
      ("0" + date.getDate()).slice(-2) +
      ("0" + date.getHours()).slice(-2) +
      ("0" + date.getMinutes()).slice(-2) +
      ("0" + date.getSeconds()).slice(-2);

    const shortcode = 174379;
    const passkey =
      "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";

    const password = Buffer.from(shortcode + passkey + timestamp).toString(
      "base64",
    );

    const response = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: mpesaPhone,
        PartyB: shortcode,
        PhoneNumber: mpesaPhone,
        CallBackURL:
          "https://altha-unsimular-pseudoclerically.ngrok-free.dev/callback",
        AccountReference: mpesaPhone,
        TransactionDesc: "Payment",
      },
      {
        headers: {
          Authorization: `Bearer ${req.token}`,
        },
        timeout: 30000,
      },
    );

    // Create pending payment record
    try {
      const created = await Payment.create({
        number: mpesaPhone,
        amount: amount,
        checkoutRequestID: response.data.CheckoutRequestID,
        merchantRequestID: response.data.MerchantRequestID,
        status: "pending",
        sapStatus: "pending",
      });
      console.log(
        `Pending payment created for ${mpesaPhone} (id: ${created._id})`,
      );
      // mark dbSaved for inclusion in response
      res.locals.dbSaved = true;
    } catch (dbErr) {
      console.error("Failed to create pending payment:", dbErr);
      // mark dbSaved false so caller can see DB save failed during debugging
      res.locals.dbSaved = false;
      // We continue even if DB save fails, as the STK push was successful
    }

    // Include dbSaved flag (undefined means not attempted)
    const responsePayload = {
      success: true,
      ...response.data,
    };
    if (typeof res.locals.dbSaved !== "undefined")
      responsePayload.dbSaved = !!res.locals.dbSaved;

    res.status(200).json(responsePayload);
  } catch (err) {
    console.error("STK Push error:", err.message);
    const errorMsg =
      err.response?.data?.errorMessage ||
      err.response?.data?.ResponseDescription ||
      err.message;
    res.status(400).json({
      success: false,
      error: errorMsg,
    });
  }
});

app.post("/callback", async (req, res) => {
  const callbackData = req.body;
  console.log("Received M-Pesa callback");
  console.log("Callback data:", JSON.stringify(callbackData, null, 2));

  const callback = callbackData.Body && callbackData.Body.stkCallback;
  if (!callback) {
    console.log("No valid callback data received");
    return res.status(200).json({
      success: false,
      message: "No callback data",
    });
  }

  const {
    ResultCode,
    ResultDesc,
    CallbackMetadata,
    CheckoutRequestID,
    MerchantRequestID,
  } = callback;
  console.log(
    `STK Callback - ResultCode: ${ResultCode}, CheckoutRequestID: ${CheckoutRequestID}`,
  );
  console.log(`Description: ${ResultDesc}`);

  if (ResultCode !== 0) {
    console.log(`Transaction failed: ${ResultDesc}`);

    // Delete the pending payment record as requested
    try {
      const result = await Payment.deleteOne({
        checkoutRequestID: callback.CheckoutRequestID,
      });

      if (result.deletedCount > 0) {
        console.log(
          `Pending payment deleted for failed transaction: ${callback.CheckoutRequestID}`,
        );
      } else {
        console.log(
          `No pending payment found to delete for: ${callback.CheckoutRequestID}`,
        );
      }
    } catch (err) {
      console.error("Error deleting failed payment:", err.message);
    }

    return res.status(200).json({
      success: true,
      message: "processed_failure_deleted",
      reason: ResultDesc,
    });
  }

  let phone = null;
  let amount = null;
  let trnx_id = null;

  if (CallbackMetadata && Array.isArray(CallbackMetadata.Item)) {
    const items = CallbackMetadata.Item;
    const findByName = (name) =>
      items.find((it) => it.Name === name || it.name === name);

    const amountItem =
      findByName("Amount") || items.find((it) => typeof it.Value === "number");
    const trnxItem =
      findByName("MpesaReceiptNumber") || findByName("MpesaReceiptId");
    const phoneItem =
      findByName("PhoneNumber") ||
      items.find((it) => String(it.Value).startsWith("254"));

    phone = phoneItem ? String(phoneItem.Value) : null;
    amount = amountItem ? Number(amountItem.Value) : null;
    trnx_id = trnxItem ? String(trnxItem.Value) : null;
  }

  try {
    // Try to find existing payment by CheckoutRequestID
    console.log(
      `Looking for payment with CheckoutRequestID: ${callback.CheckoutRequestID}`,
    );
    const existingPayment = await Payment.findOne({
      checkoutRequestID: callback.CheckoutRequestID,
    });

    if (existingPayment) {
      console.log(`Found existing payment: ${existingPayment._id}`);
      // Do NOT mark as paid here. Keep as pending until SAP incoming payment is created.
      existingPayment.trnx_id = trnx_id;
      existingPayment.raw = callback;
      if (amount) existingPayment.amount = amount; // confirm amount
      if (phone) existingPayment.number = phone; // confirm phone

      // Mark STK confirmation metadata so we know callback arrived
      existingPayment.stkConfirmed = true;
      existingPayment.stkConfirmedAt = new Date();

      // Ensure status remains pending (so it stays in Unutilized list)
      existingPayment.status =
        existingPayment.status === "paid" ? "paid" : "pending";

      await existingPayment.save();
      console.log(
        `STK callback applied: ${trnx_id} id:${existingPayment._id} status:${existingPayment.status} stkConfirmed:${existingPayment.stkConfirmed}`,
      );

      return res.status(200).json({
        success: true,
        message: "stk_callback_applied",
        payment: existingPayment,
      });
    }

    console.log(
      `No existing payment found for CheckoutRequestID: ${callback.CheckoutRequestID}. Creating fallback payment.`,
    );

    // Fallback: Create new payment if not found (legacy behavior)
    // Fallback: create a pending payment record (do not mark paid yet)
    const payment = await Payment.create({
      number: phone,
      amount,
      trnx_id,
      checkoutRequestID: callback.CheckoutRequestID,
      merchantRequestID: callback.MerchantRequestID,
      status: "pending",
      sapStatus: "pending",
      stkConfirmed: true,
      stkConfirmedAt: new Date(),
      raw: callback,
    });

    console.log(
      `Payment saved (new, pending): ${trnx_id} id:${payment._id} status:${payment.status} stkConfirmed:${payment.stkConfirmed}`,
    );
    return res.status(200).json({
      success: true,
      message: "saved_new",
      payment,
    });
  } catch (err) {
    console.error("Error saving payment callback:", err);
    console.error("Error details:", {
      message: err.message,
      code: err.code,
      name: err.name,
    });
    return res.status(200).json({
      success: false,
      message: "error",
      error: err.message,
    });
  }
});

// DEBUG: return latest payments (limited, no auth - remove in production)
app.get("/debug/payments/latest", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || "20", 10);
    const payments = await Payment.find()
      .select(
        "number amount trnx_id status sapStatus createdAt updatedAt checkoutRequestID",
      )
      .sort({ createdAt: -1 })
      .limit(Math.min(100, limit))
      .lean();

    res.json({ success: true, count: payments.length, data: payments });
  } catch (e) {
    console.error("Debug payments error:", e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Check Payment Status Endpoint
app.get("/stk/status/:checkoutRequestID", async (req, res) => {
  try {
    const { checkoutRequestID } = req.params;
    const payment = await Payment.findOne({ checkoutRequestID });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment request not found",
      });
    }

    res.json({
      success: true,
      status: payment.status,
      stkConfirmed: payment.stkConfirmed || false,
      trnx_id: payment.trnx_id,
      amount: payment.amount,
      phone: payment.number,
    });
  } catch (err) {
    console.error("Check status error:", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ====================
// SYSTEM STATUS ROUTES
// ====================

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    sapSession: sapSessionManager.getSessionInfo(),
    authTokens: authTokenManager.getAppInstanceInfo(),
    cacheStats: cache.getStats(),
  });
});

// Clear cache endpoint (admin only)
app.post("/admin/clear-cache", verifyAdmin, (req, res) => {
  const { pattern } = req.body;
  let cleared = 0;

  if (pattern) {
    const keys = cache.keys();
    const regex = new RegExp(pattern);
    keys.forEach((key) => {
      if (regex.test(key)) {
        cache.del(key);
        cleared++;
      }
    });
  } else {
    cache.flushAll();
    cleared = cache.getStats().keys;
  }

  res.json({
    success: true,
    message: `Cache cleared (${cleared} items)`,
    cleared,
  });
});

// ====================
// HOME ROUTE
// ====================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Payment API Server with SAP Integration",
    status: "active",
    timestamp: new Date().toISOString(),
    appInstanceInfo: authTokenManager.getAppInstanceInfo(),
    sapSessionInfo: sapSessionManager.getSessionInfo(),
    performance: {
      cacheItems: cache.getStats().keys,
      database:
        mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    },
    security: {
      appAuth: "Tokens invalidate on app restart",
      sapAuth: "SAP session invalidates on logout & restart",
      cache: "SAP data cached for 5 minutes",
    },
    endpoints: {
      auth: [
        "POST /register",
        "POST /auth",
        "POST /logout",
        "POST /validate-token",
        "GET /auth/info",
        "GET /auth/test-users",
      ],
      sap: [
        "POST /api/sap/login",
        "POST /api/sap/logout",
        "GET /api/sap/session",
        "GET /api/sap/business-partners",
        "GET /api/sap/business-partners/:cardCode",
        "GET /api/sap/invoices",
        "POST /api/sap/incoming-payments",
      ],
      mpesa: ["POST /stk", "POST /callback"],
      admin: [
        "GET /admin/users",
        "GET /admin/payments",
        "GET /admin/payments/:id",
        "PATCH /admin/payments/:id",
        "POST /admin/payments/:id/confirm",
        "PATCH /admin/payments/:id/mark-paid",
        "POST /admin/promote",
      ],
      system: ["GET /health", "POST /admin/clear-cache"],
    },
    version: "3.0.0",
    note: "Both app auth tokens and SAP sessions are invalidated on logout and app restart.",
  });
});

// ====================
// ERROR HANDLING
// ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    path: req.originalUrl,
    method: req.method,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global error:", err.stack);

  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
    path: req.originalUrl,
  });
});

// ====================
// APP SHUTDOWN HANDLING
// ====================

const setupShutdownHandlers = () => {
  const shutdown = async (signal) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);

    // Invalidate all tokens on restart
    authTokenManager.invalidateOnRestart();

    // Invalidate SAP session
    await sapSessionManager.logoutFromSAP();

    // Clear cache
    cache.flushAll();
    console.log("Cache cleared");

    // Close MongoDB connection
    await mongoose.connection.close();
    console.log("MongoDB connection closed");

    // Close server
    server.close(() => {
      console.log("HTTP server closed");
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      console.error(
        "Could not close connections in time, forcefully shutting down",
      );
      process.exit(1);
    }, 10000);
  };

  // Handle shutdown signals
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGQUIT", () => shutdown("SIGQUIT"));

  // Handle uncaught exceptions
  process.on("uncaughtException", (err) => {
    console.error("❌ Uncaught Exception:", err);
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  });
};

// ====================
// START SERVER
// ====================

const server = app.listen(PORT, () => {
  console.log(`
 Server running on port ${PORT}
 Local: http://localhost:${PORT}

 AUTHENTICATION
   App Instance ID: ${authTokenManager.getAppInstanceInfo().id}
   App Started: ${authTokenManager.getAppInstanceInfo().startedAt}
   
 SAP INTEGRATION
   SAP Session: ${sapSessionManager.getSessionInfo().isActive ? "Active" : "Inactive"}
   SAP Instance ID: ${sapSessionManager.getSessionInfo().appInstanceId}
   
 CACHE & PERFORMANCE
   Cache Items: ${cache.getStats().keys}
   SAP requests cached for 5 minutes
   
 SECURITY FEATURES
   • App tokens invalidate on app restart
   • SAP sessions invalidate on logout & restart
   • Auto-logout on session expiry
   • Token blacklisting enabled
	`);

  // Setup shutdown handlers
  setupShutdownHandlers();
});

// Export app for testing
export default app;
