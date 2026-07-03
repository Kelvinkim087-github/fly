// components/SimpleLogin.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const SimpleLogin = ({ onLogin, isAuthenticated }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect to home if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, navigate]);

  // Check for restart or session expiry messages in URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);

    if (params.get("session") === "expired") {
      setError("Your session has expired. Please login again.");
    } else if (params.get("reason") === "app_restarted") {
      setError("The application was restarted. Please login again.");
      setInfoMessage(
        "For security, all sessions are terminated when the app restarts.",
      );
    } else if (params.get("restart") === "true") {
      setError("Application was restarted. Please login again.");
    }

    // Clear URL parameters after reading them
    if (params.toString()) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfoMessage("");

    try {
      const response = await fetch("http://localhost:3500/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user: username, pwd: password }),
        timeout: 10000, // 10 second timeout
      });

      const data = await response.json();

      if (response.ok) {
        // Save token and roles to localStorage
        localStorage.setItem("token", data.accessToken);
        localStorage.setItem("roles", JSON.stringify(data.roles || ["User"]));

        // Store app instance info if provided
        if (data.appInstanceInfo?.id) {
          localStorage.setItem("app_instance_id", data.appInstanceInfo.id);
        }

        // Call onLogin callback with token and roles
        if (onLogin) onLogin(data.accessToken, data.roles || ["User"]);

        // Redirect to home page
        navigate("/");
      } else {
        throw new Error(data.message || "Login failed");
      }
    } catch (err) {
      console.error("Login error:", err);

      // Handle different error types
      if (err.name === "AbortError" || err.message.includes("timeout")) {
        setError("Connection timeout. Please check if the server is running.");
      } else if (
        err.message.includes("Failed to fetch") ||
        err.message.includes("NetworkError")
      ) {
        // Backend might not be running
        setError(
          "Cannot connect to server. Please ensure the backend is running.",
        );
        setInfoMessage(
          "Server may be restarting or unavailable. Try again in a moment.",
        );
      } else {
        setError(err.message || "Login failed. Please check credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "calc(100vh - 70px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#f5f5f5",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "50%",
          maxWidth: "450px",
          margin: "0 auto",
          padding: "40px",
          backgroundColor: "white",
          borderRadius: "12px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
        }}
      >
        <h2
          style={{
            textAlign: "center",
            marginBottom: "10px",
            color: "#091446ff",
            fontSize: "28px",
          }}
        >
          Login
        </h2>

        <p
          style={{
            textAlign: "center",
            color: "#666",
            marginBottom: "30px",
            fontSize: "14px",
          }}
        >
          Enter your credentials to access the payment system
        </p>

        {error && (
          <div
            style={{
              backgroundColor: "#f8d7da",
              color: "#721c24",
              padding: "12px",
              borderRadius: "6px",
              marginBottom: "20px",
              border: "1px solid #f5c6cb",
              fontSize: "14px",
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {infoMessage && (
          <div
            style={{
              backgroundColor: "#d1ecf1",
              color: "#0c5460",
              padding: "12px",
              borderRadius: "6px",
              marginBottom: "20px",
              border: "1px solid #bee5eb",
              fontSize: "14px",
            }}
          >
            <strong>Info:</strong> {infoMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "24px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "500",
                color: "#333",
              }}
            >
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              style={{
                width: "100%",
                padding: "14px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "16px",
                boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#091446ff")}
              onBlur={(e) => (e.target.style.borderColor = "#ddd")}
            />
          </div>

          <div style={{ marginBottom: "30px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "500",
                color: "#333",
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              style={{
                width: "100%",
                padding: "14px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "16px",
                boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#091446ff")}
              onBlur={(e) => (e.target.style.borderColor = "#ddd")}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "16px",
              backgroundColor: loading ? "#ccc" : "#091446ff",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontSize: "16px",
              fontWeight: "600",
              cursor: loading ? "not-allowed" : "pointer",
              marginBottom: "15px",
              transition: "background-color 0.2s, transform 0.1s",
            }}
            onMouseEnter={(e) =>
              !loading && (e.target.style.backgroundColor = "#070e2e")
            }
            onMouseLeave={(e) =>
              !loading && (e.target.style.backgroundColor = "#091446ff")
            }
            onMouseDown={(e) =>
              !loading && (e.target.style.transform = "scale(0.98)")
            }
            onMouseUp={(e) =>
              !loading && (e.target.style.transform = "scale(1)")
            }
          >
            {loading ? (
              <span>
                <span
                  style={{
                    display: "inline-block",
                    width: "16px",
                    height: "16px",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTop: "2px solid white",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                    marginRight: "10px",
                    verticalAlign: "middle",
                  }}
                ></span>
                Logging in...
              </span>
            ) : (
              "Login"
            )}
          </button>
        </form>

        {/* Demo/Testing Section */}
        <div
          style={{
            marginTop: "30px",
            paddingTop: "25px",
            borderTop: "1px solid #eee",
            textAlign: "center",
          }}
        >
          <p
            style={{
              color: "#666",
              marginBottom: "15px",
              fontSize: "14px",
            }}
          >
            Need an account?
          </p>
          <button
            onClick={() => navigate("/register")}
            style={{
              padding: "12px 24px",
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontSize: "15px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "background-color 0.2s, transform 0.1s",
              width: "100%",
            }}
            onMouseEnter={(e) => (e.target.style.backgroundColor = "#218838")}
            onMouseLeave={(e) => (e.target.style.backgroundColor = "#28a745")}
          >
            Create New Account
          </button>

          {/* Security Notice */}
          <div
            style={{
              marginTop: "30px",
              padding: "15px",
              backgroundColor: "#f8f9fa",
              borderRadius: "6px",
              border: "1px solid #e9ecef",
              fontSize: "13px",
              color: "#666",
              textAlign: "left",
            }}
          >
            <strong>🔒 Security Notice:</strong>
            <p style={{ margin: "8px 0 0 0" }}>
              For security reasons, all user sessions are automatically
              terminated when the server restarts. You will need to login again
              after server maintenance or updates.
            </p>
          </div>
        </div>
      </div>

      {/* CSS for spinner animation */}
      <style>{`
				@keyframes spin {
					0% { transform: rotate(0deg); }
					100% { transform: rotate(360deg); }
				}
			`}</style>
    </div>
  );
};

export default SimpleLogin;
