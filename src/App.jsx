import React, { useState, useEffect } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";

import PaymentFormFixed from "./components/PaymentForm.jsx";
import SimpleLogin from "./components/SimpleLogin.jsx";
import Register from "./components/Register.jsx";
import UnutilizedPayments from "./components/UnutilizedPayments.jsx";
import UtilizedPayments from "./components/UtilizedPayments.jsx";
import ConfirmSTKPayment from "./components/ConfirmSTKPayment.jsx";
import AdminUsers from "./components/AdminUsers.jsx";
import "./App.css";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRoles, setUserRoles] = useState([]);
  const [appInstanceId, setAppInstanceId] = useState(
    localStorage.getItem("app_instance_id"),
  );
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    // Clear auth tokens when the app/tab is closing
    const handleAppStop = () => {
      localStorage.removeItem("token");
      localStorage.removeItem("roles");
      localStorage.removeItem("app_instance_id");
    };

    window.addEventListener("beforeunload", handleAppStop);
    return () => window.removeEventListener("beforeunload", handleAppStop);
  }, []);

  const clearAuth = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("roles");
    setIsAuthenticated(false);
    setUserRoles([]);
  };

  const handleLogin = (token, roles) => {
    localStorage.setItem("token", token);
    localStorage.setItem("roles", JSON.stringify(roles || ["User"]));
    setIsAuthenticated(true);
    setUserRoles(roles || ["User"]);

    // Extract app instance ID from token
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.appInstanceId) {
        localStorage.setItem("app_instance_id", payload.appInstanceId);
        setAppInstanceId(payload.appInstanceId);
      }
    } catch (e) {
      console.warn("Could not extract app instance ID from token");
    }
  };

  const handleLogout = async () => {
    // Try to notify backend
    const token = localStorage.getItem("token");
    if (token) {
      try {
        await fetch("https://server-dnkw.onrender.com/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
      } catch (error) {
        console.warn("Logout API call failed:", error);
      }
    }

    clearAuth();
    // Clear app instance ID only on logout (not on app restart)
    localStorage.removeItem("app_instance_id");
    setAppInstanceId(null);
  };

  const isAdmin = userRoles.includes("Admin");

  return (
    <Router>
      <div style={{ margin: 0, padding: 0 }}>
        {/* Navigation Bar */}
        <nav style={navStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
            }}
          >
            <div style={navBrandStyle}>
              M-Pesa Payment System
              {isAuthenticated && (
                <span
                  style={{
                    fontSize: "12px",
                    backgroundColor: isAdmin ? "#dc3545" : "#28a745",
                    color: "white",
                    padding: "2px 8px",
                    borderRadius: "10px",
                    marginLeft: "10px",
                  }}
                >
                  {isAdmin ? "Admin" : "User"}
                </span>
              )}
            </div>

            {/* Hamburger Icon */}
            <button
              className="hamburger-btn"
              style={hamburgerStyle}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              <div
                style={{
                  ...hamburgerLineStyle,
                  transform: isMenuOpen
                    ? "rotate(45deg) translate(5px, 5px)"
                    : "none",
                }}
              />
              <div
                style={{
                  ...hamburgerLineStyle,
                  opacity: isMenuOpen ? 0 : 1,
                }}
              />
              <div
                style={{
                  ...hamburgerLineStyle,
                  transform: isMenuOpen
                    ? "rotate(-45deg) translate(7px, -6px)"
                    : "none",
                }}
              />
            </button>

            <div
              className={`nav-links-container ${isMenuOpen ? "open" : ""}`}
              style={navLinksContainerStyle}
            >
              {/* Always show Home link */}
              <NavLink
                to="/"
                style={({ isActive }) => ({
                  ...linkStyle,
                  ...(isActive ? activeLinkStyle : {}),
                })}
                onClick={() => setIsMenuOpen(false)}
              >
                Home
              </NavLink>

              {/* Conditional links based on auth */}
              {isAuthenticated ? (
                <>
                  <NavLink
                    to="/payment"
                    style={({ isActive }) => ({
                      ...linkStyle,
                      ...(isActive ? activeLinkStyle : {}),
                    })}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Make Payment
                  </NavLink>

                  {/* Admin-only links */}
                  {isAdmin && (
                    <>
                      <NavLink
                        to="/admin/payments"
                        style={({ isActive }) => ({
                          ...linkStyle,
                          ...(isActive ? activeLinkStyle : {}),
                        })}
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Unutilized Payments
                      </NavLink>
                      <NavLink
                        to="/admin/utilized-payments"
                        style={({ isActive }) => ({
                          ...linkStyle,
                          ...(isActive ? activeLinkStyle : {}),
                        })}
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Utilized Payments
                      </NavLink>
                      <NavLink
                        to="/admin/users"
                        style={({ isActive }) => ({
                          ...linkStyle,
                          ...(isActive ? activeLinkStyle : {}),
                        })}
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Manage Users
                      </NavLink>
                    </>
                  )}

                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMenuOpen(false);
                    }}
                    style={logoutButtonStyle}
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  {/* Show both Login and Register when not authenticated */}
                  <NavLink
                    to="/login"
                    style={({ isActive }) => ({
                      ...linkStyle,
                      ...(isActive ? activeLinkStyle : {}),
                    })}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Login
                  </NavLink>
                  <NavLink
                    to="/register"
                    style={({ isActive }) => ({
                      ...registerLinkStyle,
                      ...(isActive ? activeLinkStyle : {}),
                    })}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Register
                  </NavLink>
                </>
              )}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <div style={{ padding: "0px" }}>
          <Routes>
            {/* Public Routes */}
            <Route
              path="/"
              element={
                <Home
                  isAdmin={isAdmin}
                  isAuthenticated={isAuthenticated}
                  appInstanceId={appInstanceId}
                />
              }
            />

            <Route
              path="/login"
              element={
                <SimpleLogin
                  onLogin={handleLogin}
                  isAuthenticated={isAuthenticated}
                />
              }
            />

            {/* Add Register Route */}
            <Route path="/register" element={<Register />} />

            {/* Protected Routes - Require Authentication */}
            <Route
              path="/payment"
              element={
                isAuthenticated ? (
                  <PaymentFormFixed />
                ) : (
                  <Navigate to="/login" />
                )
              }
            />

            {/* Admin Routes - Require Admin Role */}
            <Route
              path="/admin/payments"
              element={isAdmin ? <UnutilizedPayments /> : <Navigate to="/" />}
            />
            <Route
              path="/admin/utilized-payments"
              element={isAdmin ? <UtilizedPayments /> : <Navigate to="/" />}
            />
            <Route
              path="/admin/payments/confirm/:id"
              element={isAdmin ? <ConfirmSTKPayment /> : <Navigate to="/" />}
            />

            <Route
              path="/admin/users"
              element={isAdmin ? <AdminUsers /> : <Navigate to="/" />}
            />

            {/* Redirect unknown routes to home */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

// Home Component - Updated to show restart messages
function Home({ isAdmin, isAuthenticated, appInstanceId }) {
  const location = useLocation();
  const [showRestartMessage, setShowRestartMessage] = useState(false);

  useEffect(() => {
    // Check for restart message in URL
    const params = new URLSearchParams(location.search);
    if (params.get("restart") === "true") {
      setShowRestartMessage(true);
      // Remove the parameter from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Check if app instance ID is missing (app restarted)
    const storedInstanceId = localStorage.getItem("app_instance_id");
    if (!storedInstanceId && isAuthenticated) {
      setShowRestartMessage(true);
    }
  }, [location, isAuthenticated]);

  return (
    <div style={{ textAlign: "center", padding: "40px" }}>
      <h2 style={{ textAlign: "center", padding: "40px" }}>
        Welcome to M-Pesa Payment System
      </h2>

      {/* Show restart message if needed */}
      {showRestartMessage && isAuthenticated && (
        <div
          style={{
            backgroundColor: "#fff3cd",
            border: "1px solid #ffeaa7",
            color: "#856404",
            padding: "15px",
            borderRadius: "5px",
            margin: "20px auto",
            maxWidth: "600px",
            textAlign: "center",
          }}
        >
          <strong>⚠️ Application Restarted</strong>
          <p style={{ margin: "10px 0 0 0" }}>
            The application was restarted. You have been logged out for security
            reasons. Please login again.
          </p>
        </div>
      )}

      {/* Feature Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 400px))",
          justifyContent: "center",
          alignItems: "center",
          gap: "20px",
          marginTop: "0px",
        }}
      >
        {/* Conditional cards */}
        {isAuthenticated ? (
          <>
            <Card
              title="Make Payment"
              description="Complete payment form with authentication"
              link="/payment"
              linkText="Make Payment"
              color="#ffc107"
              icon="💰"
            />

            {isAdmin && (
              <>
                <Card
                  title="Unutilized Payments"
                  description="View payments pending SAP processing"
                  link="/admin/payments"
                  linkText="Unutilized"
                  color="#9c27b0"
                  icon="📊"
                />
                <Card
                  title="Utilized Payments"
                  description="View payments already processed in SAP"
                  link="/admin/utilized-payments"
                  linkText="Utilized"
                  color="#28a745"
                  icon="✅"
                />
              </>
            )}
          </>
        ) : (
          <>
            <Card
              title="Login"
              description="Login to access payment features and admin panel"
              link="/login"
              linkText="Go to Login"
              color="#007bff"
              icon="🔐"
            />
            <Card
              title="Register"
              description="Create a new account to access the payment system"
              link="/register"
              linkText="Sign Up"
              color="#28a745"
              icon="📝"
            />
          </>
        )}
      </div>
    </div>
  );
}

// Status Card Component
function StatusCard({ title, status, description, color, link, linkText }) {
  return (
    <div
      style={{
        backgroundColor: "white",
        borderRadius: "8px",
        padding: "20px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        borderTop: `4px solid ${color}`,
        textAlign: "left",
      }}
    >
      <h3 style={{ color, marginTop: 0, fontSize: "18px" }}>{title}</h3>
      <div style={{ fontSize: "24px", fontWeight: "bold", margin: "10px 0" }}>
        {status}
      </div>
      <p style={{ color: "#666", marginBottom: "15px" }}>{description}</p>
      {link && (
        <Link to={link}>
          <button
            style={{
              backgroundColor: color,
              color: "white",
              border: "none",
              padding: "8px 16px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            {linkText}
          </button>
        </Link>
      )}
    </div>
  );
}

// Card Component
function Card({ title, description, link, linkText, color, icon }) {
  return (
    <div
      style={{
        backgroundColor: "white",
        borderRadius: "8px",
        padding: "25px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        borderTop: `4px solid ${color}`,
        transition: "transform 0.2s",
        ":hover": {
          transform: "translateY(-5px)",
        },
      }}
    >
      <div style={{ fontSize: "40px", marginBottom: "15px" }}>{icon}</div>
      <h3 style={{ color, marginTop: 0 }}>{title}</h3>
      <p style={{ color: "#666", marginBottom: "20px" }}>{description}</p>
      <Link to={link}>
        <button
          style={{
            backgroundColor: color,
            color: "white",
            border: "none",
            padding: "10px 20px",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
            width: "100%",
          }}
        >
          {linkText}
        </button>
      </Link>
    </div>
  );
}

// Styles (same as before)
const navStyle = {
  backgroundColor: "#091446ff",
  padding: "15px 30px",
  display: "flex",
  justifyContent: "space-around",
  alignItems: "center",
  boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
  margin: 0,
  width: "100%",
};

const navBrandStyle = {
  color: "white",
  fontSize: "22px",
  fontWeight: "bold",
  display: "flex",
  alignItems: "center",
};

const linkStyle = {
  color: "white",
  textDecoration: "none",
  padding: "8px 16px",
  borderRadius: "4px",
  transition: "background-color 0.2s, color 0.2s",
  fontSize: "14px",
  fontWeight: "500",
};

const activeLinkStyle = {
  color: "white",
  backgroundColor: "#28a745",
};

const registerLinkStyle = {
  ...linkStyle,
};

const logoutButtonStyle = {
  background: "transparent",
  backgroundColor: "black",
  marginTop: "0px",
  border: "1px solid white",
  color: "white",
  padding: "8px 16px",
  borderRadius: "2px",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: "500",
  transition: "background-color 0.2s",
};

const navLinksContainerStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "55px",
  alignItems: "center",
};

const hamburgerStyle = {
  display: "none",
  flexDirection: "column",
  justifyContent: "space-between",
  width: "30px",
  height: "21px",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: "0",
  marginTop: "0px",
  zIndex: 101,
  outline: "none", // Remove focus outline
  WebkitTapHighlightColor: "transparent", // Remove mobile tap highlight
};

const hamburgerLineStyle = {
  width: "100%",
  height: "3px",
  backgroundColor: "white",
  borderRadius: "10px",
  transition: "all 0.3s ease",
};

// Add responsive styles via a simple injectStyle helper or raw CSS
const responsiveStyles = `
  .nav-links-container a {
    transition: all 0.3s ease;
  }
  .nav-links-container a:hover {
    background-color: #28a745 !important;
    color: white !important;
  }
  .hamburger-btn {
    display: none;
  }
  @media (max-width: 900px) {
    .nav-links-container {
      display: none !important;
      flex-direction: column;
      position: absolute;
      top: 60px;
      left: 0;
      background-color: #091446;
      width: 100%;
      padding: 20px;
      gap: 15px !important;
      box-shadow: 0 5px 10px rgba(0,0,0,0.2);
      z-index: 100;
	  align-items: flex-start !important;
    }
    .hamburger-btn {
      display: flex !important;
    }
    .hamburger-btn:hover {
      opacity: 0.8;
    }
    .nav-links-container a:hover {
      background-color: #28a745 !important;
      color: white !important;
    }
    .nav-links-container.open {
      display: flex !important;
    }
  }
`;

// In-line styles for the containers
// (Removing the incorrect Object.assigns)

// Add hover effects
Object.assign(linkStyle, {
  ":hover": {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
});

Object.assign(registerLinkStyle, {
  ":hover": {
    backgroundColor: "#218838",
    borderColor: "#401ac7ff",
  },
});

Object.assign(logoutButtonStyle, {
  ":hover": {
    backgroundColor: "rgba(243, 5, 5, 0.1)",
  },
});

// Inject media queries manually if not using a separate CSS file
if (typeof document !== "undefined") {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = responsiveStyles;
  document.head.appendChild(styleSheet);
}

export default App;
