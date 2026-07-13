// components/AdminUsers.js
import React, { useState, useEffect } from "react";
import axios from "axios";

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [promoteUser, setPromoteUser] = useState("");
  const [promoteLoading, setPromoteLoading] = useState(false);
  const [promoteSuccess, setPromoteSuccess] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(t);
    }
  }, [error]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      const response = await axios.get("http://kelvin:3500/admin/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Backend returns: { success: true, data: users }
      // axios response.data contains the JSON response
      let userData = response.data;

      if (userData && Array.isArray(userData.data)) {
        // Backend returns users in 'data' property
        setUsers(userData.data);
      } else if (Array.isArray(userData)) {
        // Fallback: if response is directly an array
        setUsers(userData);
      } else if (userData && Array.isArray(userData.users)) {
        // Fallback: if response has 'users' property
        setUsers(userData.users);
      } else {
        console.warn("Unexpected API response format:", userData);
        setUsers([]);
      }
      setError("");
    } catch (err) {
      console.error("Error fetching users:", err);
      setError("Failed to load users. " + (err.response?.data?.message || ""));

      // For network errors, provide clear message
      if (err.code === "ERR_NETWORK") {
        setError("Backend not reachable. Please ensure the server is running.");
        setUsers([]);
      } else {
        // Ensure users is set to empty array on error
        setUsers([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePromote = async (username) => {
    if (!username) {
      setPromoteSuccess("");
      setError("Please enter a username");
      return;
    }

    setPromoteLoading(true);
    setError("");
    setPromoteSuccess("");

    try {
      const token = localStorage.getItem("token");

      const response = await axios.post(
        "http://kelvin:3500/admin/promote",
        { targetUser: username },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      setPromoteSuccess(`User "${username}" promoted to admin successfully!`);
      setPromoteUser("");

      // Refresh users list
      fetchUsers();

      // Clear success message after 5 seconds
      setTimeout(() => setPromoteSuccess(""), 5000);
    } catch (err) {
      console.error("Error promoting user:", err);
      setError(err.response?.data?.message || "Failed to promote user");

      // For demo purposes, simulate success
      if (err.code === "ERR_NETWORK") {
        setPromoteSuccess(
          `[Demo] User "${username}" would be promoted to admin`,
        );
        setPromoteUser("");
        setTimeout(() => setPromoteSuccess(""), 3000);
      }
    } finally {
      setPromoteLoading(false);
    }
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (e) {
      return dateString || "N/A";
    }
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "8px",
          padding: "30px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: "30px" }}>User Management</h1>

        {/* Promote User Form */}
        <div
          style={{
            backgroundColor: "#f8f9fa",
            padding: "20px",
            borderRadius: "6px",
            marginBottom: "30px",
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: "15px" }}>
            Promote to Admin
          </h3>

          {promoteSuccess && (
            <div
              style={{
                backgroundColor: "#d4edda",
                color: "#155724",
                padding: "10px",
                borderRadius: "4px",
                marginBottom: "15px",
              }}
            >
              {promoteSuccess}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  fontSize: "14px",
                }}
              >
                Username to Promote
              </label>
              <input
                type="text"
                placeholder="Enter username"
                value={promoteUser}
                onChange={(e) => setPromoteUser(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "14px",
                }}
              />
            </div>

            <button
              onClick={() => handlePromote(promoteUser)}
              disabled={!promoteUser.trim() || promoteLoading}
              style={{
                padding: "10px 20px",
                backgroundColor:
                  !promoteUser.trim() || promoteLoading ? "#6c757d" : "#28a745",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor:
                  !promoteUser.trim() || promoteLoading
                    ? "not-allowed"
                    : "pointer",
                height: "40px",
                flexShrink: "0",
                flexGrow: "0",
                transform: "scale(1)",
              }}
            >
              {promoteLoading ? "Promoting..." : "Promote to Admin"}
            </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: "#f8d7da",
              color: "#721c24",
              padding: "15px",
              borderRadius: "5px",
              marginBottom: "20px",
            }}
          >
            <strong>Note:</strong> {error}
          </div>
        )}

        {/* Users Table */}
        <div style={{ overflowX: "auto" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  border: "3px solid #f3f3f3",
                  borderTop: "3px solid #007bff",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  margin: "0 auto 20px",
                }}
              ></div>
              Loading users...
            </div>
          ) : !Array.isArray(users) || users.length === 0 ? (
            <div
              style={{ textAlign: "center", padding: "40px", color: "#666" }}
            >
              <div style={{ fontSize: "48px", marginBottom: "20px" }}>👥</div>
              <h3>No users found</h3>
              <p>There are no users in the system yet.</p>
            </div>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "14px",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#f8f9fa" }}>
                  <th
                    style={{
                      padding: "12px",
                      textAlign: "left",
                      borderBottom: "2px solid #dee2e6",
                    }}
                  >
                    Username
                  </th>
                  <th
                    style={{
                      padding: "12px",
                      textAlign: "left",
                      borderBottom: "2px solid #dee2e6",
                    }}
                  >
                    Roles
                  </th>
                  <th
                    style={{
                      padding: "12px",
                      textAlign: "left",
                      borderBottom: "2px solid #dee2e6",
                    }}
                  >
                    Created
                  </th>
                  <th
                    style={{
                      padding: "12px",
                      textAlign: "left",
                      borderBottom: "2px solid #dee2e6",
                    }}
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user._id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "12px", fontWeight: "500" }}>
                      {user.user}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: "5px",
                          flexWrap: "wrap",
                        }}
                      >
                        {user.roles?.map((role, index) => (
                          <span
                            key={index}
                            style={{
                              padding: "4px 10px",
                              borderRadius: "4px",
                              fontSize: "12px",
                              fontWeight: "500",
                              backgroundColor:
                                role === "Admin" ? "#dc3545" : "#6c757d",
                              color: "white",
                            }}
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "12px",
                        color: "#666",
                        fontSize: "13px",
                      }}
                    >
                      {formatDate(user.createdAt)}
                    </td>
                    <td style={{ padding: "12px" }}>
                      {!user.roles?.includes("Admin") && (
                        <button
                          onClick={() => handlePromote(user.user)}
                          disabled={promoteLoading}
                          style={{
                            padding: "6px 6px",
                            backgroundColor: promoteLoading
                              ? "#6c757d"
                              : "#17a2b8",
                            color: "white",
                            border: "none",
                            width: "150px",
                            borderRadius: "4px",
                            cursor: promoteLoading ? "not-allowed" : "pointer",
                            fontSize: "12px",
                          }}
                        >
                          Promote to Admin
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "20px",
            marginTop: "30px",
          }}
        >
          <StatCard
            title="Total Users"
            value={Array.isArray(users) ? users.length : 0}
            color="#007bff"
          />

          <StatCard
            title="Admins"
            value={
              Array.isArray(users)
                ? users.filter((u) => u.roles?.includes("Admin")).length
                : 0
            }
            color="#28a745"
          />

          <StatCard
            title="Regular Users"
            value={
              Array.isArray(users)
                ? users.filter((u) => !u.roles?.includes("Admin")).length
                : 0
            }
            color="#17a2b8"
          />
        </div>

        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
};

// Stat Card Component (reused from AdminPayments)
function StatCard({ title, value, color, icon }) {
  return (
    <div
      style={{
        backgroundColor: "white",
        borderRadius: "8px",
        padding: "20px",
        boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
        borderLeft: `4px solid ${color}`,
        display: "flex",
        alignItems: "center",
        gap: "15px",
      }}
    >
      <div style={{ fontSize: "32px" }}>{icon}</div>
      <div>
        <div
          style={{
            fontSize: "12px",
            color: "#666",
            textTransform: "uppercase",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: "24px", fontWeight: "bold", color: color }}>
          {value}
        </div>
      </div>
    </div>
  );
}

export default AdminUsers;
