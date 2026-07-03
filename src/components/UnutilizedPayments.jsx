// components/UnutilizedPayments.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const UnutilizedPayments = () => {
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
        status: "not:paid",
        ...(search && { q: search }),
        ...(minAmount && { min: minAmount }),
        ...(maxAmount && { max: maxAmount }),
      });

      const response = await axios.get(
        `https://server-curious-song-2077.fly.dev/admin/payments?${params}`,
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
      console.error("Error fetching payments:", err);
      setError(
        "Failed to load payments. " + (err.response?.data?.message || ""),
      );

      if (err.response?.status === 401) {
        setError("Session expired. Please login again.");
      } else if (err.response?.status === 400) {
        setError(
          "Failed to load payments. " + (err.response?.data?.message || ""),
        );
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

  // Navigate to confirmation page
  const goToConfirmationPage = (payment) => {
    navigate(`/admin/payments/confirm/${payment._id}`, { state: { payment } });
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

  const getPaymentStatus = (payment) => {
    if (payment.status === "paid") {
      return "Paid";
    } else if (payment.status === "failed") {
      return "Failed";
    } else if (payment.status === "sap_confirmed") {
      return "Confirmed";
    }
    return "Pending";
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Paid":
        return { bg: "#d4edda", text: "#155724" };
      case "Failed":
        return { bg: "#f8d7da", text: "#721c24" };
      default:
        return { bg: "#fff3cd", text: "#856404" };
    }
  };

  const exportToCSV = async () => {
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({
        status: "not:paid",
        nopagination: "true",
        ...(search && { q: search }),
        ...(minAmount && { min: minAmount }),
        ...(maxAmount && { max: maxAmount }),
      });

      const response = await axios.get(
        `https://server-curious-song-2077.fly.dev/admin/payments?${params}`,
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
        "STK Transaction ID",
        "Date",
        "Status",
        "Confirmed By",
        "Confirmed At",
      ];
      const csvData = allPayments.map((payment, index) => [
        index + 1,
        formatPhone(payment.number),
        payment.amount,
        payment.trnx_id || "N/A",
        formatDate(payment.createdAt),
        getPaymentStatus(payment),
        payment.confirmedBy || "N/A",
        payment.sapConfirmedAt ? formatDate(payment.sapConfirmedAt) : "N/A",
      ]);

      const csvContent = [
        headers.map((h) => `"${h}"`).join(","),
        ...csvData.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `unutilized_payments_all_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export all payments");
    }
  };

  // Filter payments by status (exclude Paid)
  const pendingPayments = payments.filter(
    (p) => getPaymentStatus(p) === "Pending",
  );
  const confirmedPayments = payments.filter(
    (p) => getPaymentStatus(p) === "Confirmed",
  );
  const failedPayments = payments.filter(
    (p) => getPaymentStatus(p) === "Failed",
  );

  // (Filtered on server via status=not:paid)

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
            <h1 style={{ margin: 0 }}>Unutilized Payments </h1>
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
              marginBottom: "px",
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
                style={{
                  padding: "10px 30px",
                  backgroundColor: "#6c757d",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
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
                style={{
                  padding: "10px 30px",
                  backgroundColor: "#6c757d",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
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
          <StatCard
            title="Unutilized Payments"
            value={payments.length}
            color="#f7bd11ff"
          />
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
              onClick={() => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                fetchPayments();
              }}
              style={{
                padding: "10px 20px",
                backgroundColor: "transparent",
                border: "none",
                borderBottom: "3px solid #007bff",
                color: "#007bff",
                fontWeight: "500",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              All Unutilized ({payments.length})
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
              Loading STK payments...
            </div>
          ) : payments.length === 0 ? (
            <div
              style={{ textAlign: "center", padding: "40px", color: "#666" }}
            >
              <div style={{ fontSize: "48px", marginBottom: "20px" }}>📭</div>
              <h3>No STK push payments found</h3>
              <p>
                Try adjusting your filters or check if STK push requests have
                been made.
              </p>
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
                      Status
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
                  {payments.map((payment, index) => {
                    const status = getPaymentStatus(payment);
                    const colors = getStatusColor(status);
                    const isPending = status === "Pending";
                    const isPaid = status === "Paid";

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
                          {isPaid && payment.confirmed_at && (
                            <div
                              style={{
                                fontSize: "11px",
                                color: "#28a745",
                                marginTop: "2px",
                              }}
                            >
                              Paid: {formatDate(payment.confirmed_at)}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "1px" }}>
                          <span
                            style={{
                              display: "inline-block",

                              borderRadius: "4px",
                              fontSize: "12px",
                              fontWeight: "500",
                              backgroundColor: colors.bg,
                              color: colors.text,
                            }}
                          >
                            {status}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "12px",
                            verticalAlign: "middle",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-start",
                            minHeight: "42px",
                          }}
                        >
                          {isPending ? (
                            <button
                              onClick={() => goToConfirmationPage(payment)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "6px 12px",
                                margin: 0,
                                height: "32px",
                                boxSizing: "border-box",
                                backgroundColor: "#28a745",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "12px",
                                fontWeight: "500",
                                lineHeight: "1.2",
                              }}
                              title="Go to confirmation page"
                            >
                              Pay
                            </button>
                          ) : isPaid ? (
                            <button
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "6px 12px",
                                backgroundColor: "#6c757d",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                fontSize: "12px",
                                fontWeight: "500",
                                lineHeight: "1.2",
                                cursor: "not-allowed",
                              }}
                              title="Payment already marked as paid"
                              disabled
                            >
                              Paid
                            </button>
                          ) : (
                            <span
                              style={{ fontSize: "12px", color: "#6c757d" }}
                            >
                              N/A
                            </span>
                          )}
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
                  of {pagination.total} STK payments
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

                  <span style={{ padding: "10px 50px" }}>
                    Page {pagination.page} of {"   "}
                    {Math.ceil(pagination.total / pagination.limit)}
                  </span>

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
function StatCard({ title, value, color, icon }) {
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

export default UnutilizedPayments;
