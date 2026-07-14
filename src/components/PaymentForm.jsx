// components/PaymentFormFixed.js - cleaned and fixed
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const PaymentFormFixed = () => {
  const [phone, setPhone] = useState("07");
  const [amount, setAmount] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [token, setToken] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showFailedModal, setShowFailedModal] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [failedReason, setFailedReason] = useState("");
  const [polling, setPolling] = useState(false);
  const pollRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const userToken = localStorage.getItem("token");
    if (!userToken) {
      setError("No authentication token found. Redirecting to login...");
      setTimeout(() => navigate("/login"), 2000);
      return;
    }
    setToken(userToken);
  }, [navigate]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(t);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 5000);
      return () => clearTimeout(t);
    }
  }, [success]);

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  const resetForm = () => {
    setTimeout(() => {
      setSuccess("");
      setAmount("1");
      setPhone("0716330683");
      setLoading(false);
    }, 3000);
  };

  const pollPaymentStatus = (checkoutRequestId) => {
    // clear any previous poll
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    let attempts = 0;
    const maxAttempts = 120;

    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(
          `https//:vercelkim.vercel.app/stk/status/${checkoutRequestId}?_ts=${Date.now()}`,
        );
        console.log("Polling status response code:", res.status);

        if (res.status === 404) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setPolling(false);
          setLoading(false);
          setFailedReason("Transaction cancelled or failed.");
          setShowFailedModal(true);
          setError("Payment failed.");
          return;
        }

        const data = await res.json();
        console.log("Polling data:", data);

        // Normalize possible transaction id fields (some servers use different keys)
        const trnxId =
          data.trnx_id ||
          data.transaction_id ||
          data.transactionId ||
          data.trx_id ||
          data.trx ||
          data.txn_id;

        // Consider payment successful if we have a transaction id (even if stkConfirmed is false)
        if (trnxId || (data.success && data.stkConfirmed)) {
          console.log(
            "Detected confirmed STK callback or transaction id:",
            trnxId,
          );
          clearInterval(pollRef.current);
          pollRef.current = null;
          setPolling(false);
          setLoading(false);
          setPaymentDetails({
            amount: data.amount,
            phone: data.phone,
            trnx_id: trnxId,
          });
          setShowSuccessModal(true);
          setSuccess("Payment successful!");
          resetForm();
        } else if (data.success && data.status === "failed") {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setPolling(false);
          setLoading(false);
          setFailedReason(
            data.reason || "Transaction was cancelled or failed.",
          );
          setShowFailedModal(true);
          setError("Payment failed.");
        } else if (attempts >= maxAttempts) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setPolling(false);
          setLoading(false);
          setError("Payment timeout - please check if you received the prompt");
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    }, 1000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setError("Please login first");
      navigate("/login");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const requestData = { phone: phone.trim(), amount: parseFloat(amount) };

      const response = await fetch("https//:vercelkim.vercel.app/stk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestData),
        mode: "cors",
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {}
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.success || data.ResponseCode === "0") {
        console.log("✅ Payment initiated, starting poll for callback...");
        setSuccess(
          `Success: Prompt sent to ${phone}. Please enter your M-Pesa PIN.`,
        );
        const checkoutRequestId = data.CheckoutRequestID;
        if (checkoutRequestId) {
          setPolling(true);
          pollPaymentStatus(checkoutRequestId);
        } else {
          setLoading(false);
        }
      } else {
        throw new Error(data.message || "Payment failed");
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const SuccessModal = () => (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        backdropFilter: "blur(5px)",
      }}
    >
      <style>{`
        @keyframes popIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <div
        style={{
          backgroundColor: "white",
          padding: "40px",
          borderRadius: "20px",
          textAlign: "center",
          maxWidth: "90%",
          width: "400px",
          boxShadow:
            "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          animation: "popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        }}
      >
        <div
          style={{
            width: "80px",
            height: "80px",
            backgroundColor: "#def7ec",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#059669"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <h3 style={{ margin: "0 0 10px", color: "#1f2937", fontSize: "24px" }}>
          Payment Successful!
        </h3>
        <p style={{ margin: "0 0 20px", color: "#6b7280" }}>
          Transaction completed successfully.
        </p>
        {paymentDetails && (
          <div
            style={{
              backgroundColor: "#f9fafb",
              padding: "15px",
              borderRadius: "10px",
              marginBottom: "20px",
              textAlign: "left",
            }}
          >
            <p style={{ margin: "5px 0", fontSize: "14px", color: "#4b5563" }}>
              <strong>Amount:</strong> KES {paymentDetails.amount}
            </p>
            <p style={{ margin: "5px 0", fontSize: "14px", color: "#4b5563" }}>
              <strong>Phone:</strong> {paymentDetails.phone}
            </p>
            <p style={{ margin: "5px 0", fontSize: "14px", color: "#4b5563" }}>
              <strong>Ref:</strong> {paymentDetails.trnx_id}
            </p>
          </div>
        )}
        <button
          onClick={() => {
            setShowSuccessModal(false);
            setPhone("07"); // Resets phone to default
            setAmount("1");
          }}
          style={{
            backgroundColor: "#059669",
            color: "white",
            border: "none",
            padding: "12px 30px",
            borderRadius: "10px",
            fontSize: "16px",
            fontWeight: "600",
            cursor: "pointer",
            width: "100%",
            transition: "background-color 0.2s",
          }}
          onMouseOver={(e) => (e.target.style.backgroundColor = "#047857")}
          onMouseOut={(e) => (e.target.style.backgroundColor = "#059669")}
        >
          Close
        </button>
      </div>
    </div>
  );

  const FailedModal = () => (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        backdropFilter: "blur(5px)",
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "40px",
          borderRadius: "20px",
          textAlign: "center",
          maxWidth: "90%",
          width: "400px",
          boxShadow:
            "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          animation: "popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        }}
      >
        <div
          style={{
            width: "80px",
            height: "80px",
            backgroundColor: "#fde8e8",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#e53e3e"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </div>
        <h3 style={{ margin: "0 0 10px", color: "#1f2937", fontSize: "24px" }}>
          Payment Failed
        </h3>
        <p style={{ margin: "0 0 20px", color: "#6b7280" }}>
          {failedReason || "Transaction could not be completed."}
        </p>
        <button
          onClick={() => setShowFailedModal(false)}
          style={{
            backgroundColor: "#e53e3e",
            color: "white",
            border: "none",
            padding: "12px 30px",
            borderRadius: "10px",
            fontSize: "16px",
            fontWeight: "600",
            cursor: "pointer",
            width: "100%",
            transition: "background-color 0.2s",
          }}
          onMouseOver={(e) => (e.target.style.backgroundColor = "#c53030")}
          onMouseOut={(e) => (e.target.style.backgroundColor = "#e53e3e")}
        >
          Close
        </button>
      </div>
    </div>
  );

  return (
    <>
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
              margin: "0 0 25px 0",
              color: "#2c3e50",
              fontSize: "24px",
              textAlign: "center",
              borderBottom: "2px solid #eee",
              paddingBottom: "15px",
            }}
          >
            M-Pesa STK Push
          </h2>

          {error && (
            <div
              style={{
                backgroundColor: "#fff5f5",
                color: "#e53e3e",
                padding: "12px",
                borderRadius: "8px",
                marginBottom: "20px",
                fontSize: "14px",
                border: "1px solid #fed7d7",
              }}
            >
              <strong>Error:</strong> {error}
            </div>
          )}

          {success && (
            <div
              style={{
                backgroundColor: "#f0fff4",
                color: "#38a169",
                padding: "12px",
                borderRadius: "8px",
                marginBottom: "20px",
                fontSize: "14px",
                border: "1px solid #c6f6d5",
              }}
            >
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  color: "#4a5568",
                  fontWeight: "600",
                  fontSize: "14px",
                }}
              >
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 0712345678"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "2px solid #edf2f7",
                  borderRadius: "8px",
                  fontSize: "16px",
                  outline: "none",
                  transition: "border-color 0.2s",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: "25px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  color: "#4a5568",
                  fontWeight: "600",
                  fontSize: "14px",
                }}
              >
                Amount (KES)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="1.00"
                min="1"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "2px solid #edf2f7",
                  borderRadius: "8px",
                  fontSize: "16px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !phone || !amount}
              style={{
                width: "100%",
                padding: "14px",
                backgroundColor: loading ? "#a0aec0" : "#48bb78",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: "700",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background-color 0.2s",
                boxShadow: "0 4px 6px rgba(72, 187, 120, 0.2)",
              }}
            >
              {loading ? "Processing..." : "Send Prompt"}
            </button>
          </form>
        </div>
      </div>

      {showSuccessModal && <SuccessModal />}
      {showFailedModal && <FailedModal />}
    </>
  );
};

export default PaymentFormFixed;
