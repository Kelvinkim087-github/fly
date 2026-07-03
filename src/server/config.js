import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
if (process.env.NODE_ENV === "production") {
  // In production, load from process.env (set by Electron)
  dotenv.config();
} else {
  // In development, load from .env file
  const envPath = path.join(__dirname, "../../.env");
  dotenv.config({ path: envPath });
}

const config = {
  // Server
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || "development",

  // Database
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/mpesa",

  // JWT
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-in-production",
  jwtExpiry: "7d",

  // M-Pesa
  mpesa: {
    consumerKey: process.env.MPESA_CONSUMER_KEY,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET,
    shortcode: process.env.MPESA_SHORTCODE,
    passkey: process.env.MPESA_PASSKEY,
    callbackUrl: process.env.MPESA_CALLBACK_URL,
    environment: process.env.MPESA_ENVIRONMENT || "sandbox",
  },

  // SAP
  sap: {
    baseUrl: process.env.SAP_BASE_URL,
    companyDB: process.env.SAP_COMPANY_DB,
    username: process.env.SAP_USERNAME,
    password: process.env.SAP_PASSWORD,
    sslRejectUnauthorized: process.env.SAP_SSL_REJECT_UNAUTHORIZED === "true",
  },

  // CORS
  corsOrigin:
    process.env.NODE_ENV === "development"
      ? "http://localhost:5173"
      : "app://.",
};

// Validate required configuration
const requiredConfig = [
  "MPESA_CONSUMER_KEY",
  "MPESA_CONSUMER_SECRET",
  "MPESA_SHORTCODE",
  "MPESA_PASSKEY",
];

requiredConfig.forEach((key) => {
  if (!process.env[key]) {
    console.warn(`Warning: ${key} is not set in environment variables`);
  }
});

export default config;
