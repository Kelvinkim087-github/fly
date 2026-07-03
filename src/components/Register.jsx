// components/Register.jsx
import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

const Register = () => {
  const [formData, setFormData] = useState({
    user: "",
    pwd: "",
    confirmPwd: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError("");
  };

  const validateForm = () => {
    if (!formData.user || !formData.pwd || !formData.confirmPwd) {
      setError("All fields are required");
      return false;
    }

    if (formData.pwd !== formData.confirmPwd) {
      setError("Passwords do not match");
      return false;
    }

    if (formData.pwd.length < 4) {
      setError("Password must be at least 4 characters");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const response = await axios.post(
        "https://server-curious-song-2077.fly.dev/register",
        {
          user: formData.user,
          pwd: formData.pwd,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      setSuccess(true);
      setFormData({ user: "", pwd: "", confirmPwd: "" });

      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (err) {
      console.error("Registration error:", err);
      setError(
        err.response?.data?.message || "Registration failed. Please try again.",
      );
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
          Register
        </h2>

        <p
          style={{
            textAlign: "center",
            color: "#666",
            marginBottom: "30px",
            fontSize: "14px",
          }}
        >
          Create an account to access the payment system
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

        {success && (
          <div
            style={{
              backgroundColor: "#d4edda",
              color: "#155724",
              padding: "12px",
              borderRadius: "6px",
              marginBottom: "20px",
              border: "1px solid #c3e6cb",
              fontSize: "14px",
            }}
          >
            <strong>Success:</strong> Registration successful! Redirecting to
            login...
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
              name="user"
              value={formData.user}
              onChange={handleChange}
              placeholder="Choose a username"
              autoComplete="username"
              style={{
                width: "100%",
                padding: "14px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "16px",
                boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
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
              name="pwd"
              value={formData.pwd}
              onChange={handleChange}
              placeholder="Enter password"
              autoComplete="new-password"
              style={{
                width: "100%",
                padding: "14px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "16px",
                boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
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
              Confirm Password
            </label>
            <input
              type="password"
              name="confirmPwd"
              value={formData.confirmPwd}
              onChange={handleChange}
              placeholder="Confirm password"
              autoComplete="new-password"
              style={{
                width: "100%",
                padding: "14px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "16px",
                boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || success}
            style={{
              width: "100%",
              padding: "16px",
              backgroundColor: loading || success ? "#ccc" : "#091446ff",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontSize: "16px",
              fontWeight: "600",
              cursor: loading || success ? "not-allowed" : "pointer",
              marginBottom: "15px",
              transition: "background-color 0.2s",
            }}
          >
            {loading ? "Registering..." : "Register"}
          </button>
        </form>

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
            Already have an account?
          </p>
          <button
            onClick={() => navigate("/login")}
            style={{
              padding: "12px 24px",
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontSize: "15px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "background-color 0.2s",
              width: "100%",
            }}
          >
            Login here
          </button>
        </div>
      </div>
    </div>
  );
};

export default Register;
