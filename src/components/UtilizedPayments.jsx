// components/UtilizedPayments.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";

const UtilizedPayments = () => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
  });

  // This evaluates to true if ALL inputs are completely empty
  const isFormEmpty = !search.trim() && !minAmount && !maxAmount;
  useEffect(() => {
    fetchPayments();
  }, [pagination.page, pagination.limit]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        status: "paid", // Only fetch paid (utilized) payments
        ...(search && { q: search }),
        ...(minAmount && { min: minAmount }),
        ...(maxAmount && { max: maxAmount }),
      });

      const response = await axios.get(
        `http://localhost:3500/admin/payments?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      // Base payments from backend
      const serverPayments = response.data.data || [];

      setPayments(serverPayments);
      setPagination((prev) => ({
        ...prev,
        total: response.data.total || 0,
      }));
      setError("");
    } catch (err) {
      console.error("Error fetching utilized payments:", err);
      setError(
        "Failed to load utilized payments. " +
          (err.response?.data?.message || ""),
      );

      if (err.response?.status === 401) {
        setError("Session expired. Please login again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchPayments();
  };

  const handleReset = () => {
    setSearch("");
    setMinAmount("");
    setMaxAmount("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const formatPhone = (phone) => {
    if (!phone) return "N/A";
    if (phone.startsWith("254")) {
      return `0${phone.substring(3, 6)} ${phone.substring(
        6,
        9,
      )} ${phone.substring(9)}`;
    }
    return phone;
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return dateString || "N/A";
    }
  };

  const formatAmount = (amount) => {
    return `KES ${Number(amount).toLocaleString()}`;
  };

  const exportToCSV = async () => {
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        status: "paid",
        nopagination: "true",
        ...(search && { q: search }),
        ...(minAmount && { min: minAmount }),
        ...(maxAmount && { max: maxAmount }),
      });

      const response = await axios.get(
        `http://localhost:3500/admin/payments?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const allPayments = response.data.data || [];

      const headers = [
        "#",
        "Phone",
        "Amount",
        "Transaction ID",
        "SAP Doc Num",
        "Date",
        "Status",
        "SAP Doc Entry",
      ];
      const csvData = allPayments.map((payment, index) => [
        index + 1,
        formatPhone(payment.number),
        payment.amount,
        payment.trnx_id || "N/A",
        payment.sapDocNum || "N/A",
        formatDate(payment.createdAt),
        "Paid",
        payment.sapDocEntry || "N/A",
      ]);

      const csvContent = [
        headers.map((h) => `"${h}"`).join(","),
        ...csvData.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Utilized Payments ${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export utilized payments");
    }
  };

  return (
    <div
      style={{
        backgroundColor: "white",
        borderRadius: "0px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        padding: "10px",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "0px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          padding: "10px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            marginBottom: "20px",
            padding: "10px",
          }}
        >
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0 }}>Utilized Payments</h1>
          </div>
          <button
            onClick={exportToCSV}
            style={{
              marginLeft: "auto",
              padding: "10px",
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              borderRadius: "2px",
              cursor: "pointer",
              width: "110px",
            }}
          >
            Export CSV
          </button>
        </div>

        {/* Filters */}
        {/* Filters */}
        <div
          style={{
            backgroundColor: "#f8f9fa",
            padding: "10px",
            borderRadius: "6px",
            marginBottom: "30px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0px",
            }}
          >
            <h3 style={{ margin: 0, fontWeight: "bold" }}>Filters</h3>
          </div>

          <form
            onSubmit={handleSearch}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.5fr auto",
              gap: "20px",
              alignItems: "flex-end",
              marginBottom: "30px",
              width: "100%",
            }}
          >
            <div style={{ minWidth: "200px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "13px",
                  color: "#555",
                  lineHeight: "1.4",
                }}
              >
                Search Phone /<br />
                Transaction ID
              </label>
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "14px",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px", minWidth: "250px" }}>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "13px",
                    color: "#555",
                  }}
                >
                  Min Amount
                </label>
                <input
                  type="number"
                  placeholder="Min"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "10px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontSize: "14px",
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "13px",
                    color: "#555",
                  }}
                >
                  Max Amount
                </label>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "10px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    fontSize: "14px",
                  }}
                />
              </div>
            </div>

            <div
              style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}
            >
              <button
                type="submit"
                /* 
          1. Check if any state is populated. 
          2. We cast values to strings or check values directly to ensure numbers are caught correctly.
        */
                disabled={!search.trim() && !minAmount && !maxAmount}
                style={{
                  padding: "10px 30px",
                  /* 3. Toggles between gray (#6c757d) and green (#28a745) matching your style code */
                  backgroundColor:
                    !search.trim() && !minAmount && !maxAmount
                      ? "#6c757d"
                      : "#28a745",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor:
                    !search.trim() && !minAmount && !maxAmount
                      ? "not-allowed"
                      : "pointer",
                  fontSize: "15px",
                  fontWeight: "500",
                  minWidth: "120px",
                }}
              >
                Search
              </button>

              <button
                type="button"
                onClick={handleReset}
                disabled={!search.trim() && !minAmount && !maxAmount}
                style={{
                  padding: "10px 30px",
                  /* 3. Toggles between gray (#6c757d) and green (#28a745) matching your style code */
                  backgroundColor:
                    !search.trim() && !minAmount && !maxAmount
                      ? "#6c757d"
                      : "#28a745",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor:
                    !search.trim() && !minAmount && !maxAmount
                      ? "not-allowed"
                      : "pointer",
                  fontSize: "15px",
                  fontWeight: "500",
                  minWidth: "120px",
                }}
              >
                Reset
              </button>
            </div>
          </form>
        </div>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "0px",
            marginBottom: "10px",
          }}
        >
          <StatCard title="Total" value={pagination.total} color="#28a745" />
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
        {/* Tabs for Status */}
        <div style={{ marginBottom: "20px" }}>
          <div
            style={{
              display: "flex",
              gap: "10px",
              borderBottom: "1px solid #dee2e6",
            }}
          >
            <button
              disabled
              style={{
                padding: "10px 20px",
                backgroundColor: "transparent",
                border: "none",
                color: "#007bff",
                fontWeight: "500",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              This Page ({payments.length})
            </button>
          </div>
        </div>
        {/* Payments Table */}
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
              Loading payments...
            </div>
          ) : payments.length === 0 ? (
            <div
              style={{ textAlign: "center", padding: "40px", color: "#666" }}
            >
              <div style={{ fontSize: "48px", marginBottom: "20px" }}>📭</div>
              <h3>No utilized payments found</h3>
              <p>Try adjusting your filters.</p>
            </div>
          ) : (
            <>
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
                        width: "50px",
                      }}
                    >
                      #
                    </th>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "left",
                        borderBottom: "2px solid #dee2e6",
                      }}
                    >
                      Phone
                    </th>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "left",
                        borderBottom: "2px solid #dee2e6",
                      }}
                    >
                      Amount
                    </th>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "left",
                        borderBottom: "2px solid #dee2e6",
                      }}
                    >
                      STK Transaction ID
                    </th>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "left",
                        borderBottom: "2px solid #dee2e6",
                      }}
                    >
                      Date
                    </th>
                    <th
                      style={{
                        padding: "12px",
                        textAlign: "left",
                        borderBottom: "2px solid #dee2e6",
                      }}
                    >
                      Doc Num
                    </th>

                    <th
                      style={{
                        padding: "12px",
                        textAlign: "left",
                        borderBottom: "2px solid #dee2e6",
                      }}
                    >
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment, index) => {
                    return (
                      <tr
                        key={payment._id}
                        style={{ borderBottom: "1px solid #eee" }}
                      >
                        <td
                          style={{
                            padding: "12px",
                            color: "#666",
                            fontSize: "12px",
                          }}
                        >
                          {(pagination.page - 1) * pagination.limit + index + 1}
                        </td>
                        <td style={{ padding: "12px" }}>
                          <div style={{ fontSize: "12px", color: "#000000ff" }}>
                            {payment.number}
                          </div>
                        </td>
                        <td
                          style={{
                            padding: "12px",
                          }}
                        >
                          {formatAmount(payment.amount)}
                        </td>
                        <td style={{ padding: "12px" }}>
                          <code
                            style={{
                              fontSize: "12px",
                            }}
                          >
                            {payment.trnx_id}
                          </code>
                        </td>
                        <td
                          style={{
                            padding: "12px",
                            color: "#000000ff",
                            fontSize: "13px",
                          }}
                        >
                          {formatDate(payment.createdAt)}
                        </td>
                        <td style={{ padding: "12px" }}>
                          <span style={{ fontSize: "12px", color: "#000" }}>
                            {payment.sapDocNum || "N/A"}
                          </span>
                        </td>

                        <td style={{ padding: "12px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "4px 12px",
                              borderRadius: "4px",
                              fontSize: "12px",
                              fontWeight: "500",
                              backgroundColor: "#d4edda",
                              color: "#155724",
                            }}
                          >
                            Paid
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "30px",
                  padding: "20px",
                  backgroundColor: "#f8f9fa",
                  borderRadius: "2px",
                }}
              >
                <div style={{ fontSize: "14px", color: "#000000ff" }}>
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                  {Math.min(
                    pagination.page * pagination.limit,
                    pagination.total,
                  )}{" "}
                  of {pagination.total}
                </div>

                <div
                  style={{ display: "flex", gap: "10px", alignItems: "center" }}
                >
                  <button
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        page: prev.page - 1,
                      }))
                    }
                    disabled={pagination.page === 1 || loading}
                    style={{
                      padding: "8px 16px",
                      backgroundColor:
                        pagination.page === 1 ? "#e9ecef" : "#007bff",
                      color: pagination.page === 1 ? "#6c757d" : "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: pagination.page === 1 ? "not-allowed" : "pointer",
                    }}
                  >
                    Previous
                  </button>

                  {/* Center Page Box */}
                  <div
                    style={{
                      fontSize: "14px",
                      color: "#000000",
                      marginTop: "16px",
                      padding: "8px 16px",
                      borderRadius: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {/* This forces exactly one clean string with zero trailing code spaces */}
                    {`Page ${pagination.page} of ${Math.ceil(pagination.total / pagination.limit)}`}
                  </div>

                  <button
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        page: prev.page + 1,
                      }))
                    }
                    disabled={
                      pagination.page * pagination.limit >= pagination.total ||
                      loading
                    }
                    style={{
                      padding: "8px 16px",
                      marginRight: "16px",
                      backgroundColor:
                        pagination.page * pagination.limit >= pagination.total
                          ? "#e9ecef"
                          : "#007bff",
                      color:
                        pagination.page * pagination.limit >= pagination.total
                          ? "#6c757d"
                          : "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor:
                        pagination.page * pagination.limit >= pagination.total
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    Next
                  </button>

                  <select
                    value={pagination.limit}
                    onChange={(e) =>
                      setPagination((prev) => ({
                        ...prev,
                        limit: Number(e.target.value),
                        page: 1,
                      }))
                    }
                    style={{
                      marginTop: "16px",
                      padding: "8px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      fontSize: "14px",
                    }}
                  >
                    <option value="10">10 per page</option>
                    <option value="25">25 per page</option>
                    <option value="50">50 per page</option>
                    <option value="100">100 per page</option>
                  </select>
                </div>
              </div>
            </>
          )}
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

// Stat Card Component
function StatCard({ title, value, color }) {
  return (
    <div
      style={{
        backgroundColor: "white",
        borderRadius: "8px",
        padding: "10px",
        boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
        borderLeft: `4px solid ${color}`,
        display: "flex",
        alignItems: "center",
        gap: "1px",
      }}
    >
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

export default UtilizedPayments;
