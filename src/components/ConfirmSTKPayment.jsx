// components/confirmstkpayments.jsx - UPDATED WITH STATUS FIX
import React, { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

const ConfirmSTKPayment = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [error, setError] = useState("");

  // SAP Business One state
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState("");
  const [sapError, setSapError] = useState("");
  const [invoiceDetails, setInvoiceDetails] = useState(null);

  useEffect(() => {
    loadPayment();
    fetchSAPCustomers();
  }, [id]);

  // Fetch customers from SAP Business One via backend proxy
  const fetchSAPCustomers = async () => {
    try {
      setError("");
      setSapError("");

      setLoadingCustomers(true);

      const token = localStorage.getItem("token");
      const response = await axios.get(
        `http://localhost:3500/api/sap/business-partners`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data && response.data.data) {
        setCustomers(response.data.data);
      } else if (response.data && response.data.value) {
        setCustomers(response.data.value);
      } else {
        setSapError("No customers found in SAP");
        setCustomers([]);
      }
    } catch (error) {
      console.error("Error fetching SAP customers:", error);
      setSapError(
        error.response?.data?.error || "Failed to load customers from SAP",
      );
      setCustomers([]);
    } finally {
      setLoadingCustomers(false);
    }
  };

  // Fetch customer invoices
  const fetchCustomerInvoices = async (customerCode) => {
    if (!customerCode) {
      setInvoices([]);
      return;
    }

    try {
      setLoadingInvoices(true);
      setInvoiceDetails(null);
      setSelectedInvoice("");

      const token = localStorage.getItem("token");

      const response = await axios.get(
        `http://localhost:3500/api/sap/invoices`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          params: {
            cardCode: customerCode,
          },
        },
      );

      console.log("SAP Invoices API Response:", response.data);

      if (response.data && response.data.success) {
        const invoices = response.data.data || [];

        // Helper to parse SAP amounts safely
        const parseSAPAmount = (amount) => {
          if (amount === null || amount === undefined) return 0;
          if (typeof amount === "number") return amount;
          if (typeof amount === "string") {
            // Remove currency symbols and commas, keep digits, dot, minus
            const clean = amount.toString().replace(/[^0-9.-]/g, "");
            return parseFloat(clean) || 0;
          }
          return 0;
        };

        const formattedInvoices = invoices.map((invoice) => ({
          ...invoice,
          Balance:
            parseSAPAmount(invoice.DocTotal) -
            parseSAPAmount(invoice.PaidToDate),
          DocDueDate: invoice.DocDueDate || invoice.DocDate,
        }));

        setInvoices(formattedInvoices);
        console.log(
          `Loaded ${formattedInvoices.length} invoices for customer ${customerCode}`,
        );
      } else {
        setInvoices([]);
        console.log("❌ No invoices found for customer:", customerCode);
      }
    } catch (error) {
      console.error("❌ Error fetching invoices:", error);
      setInvoices([]);
      setSapError(
        error.response?.data?.error ||
          "Failed to load invoices from SAP.Please Login again",
      );
    } finally {
      setLoadingInvoices(false);
    }
  };

  // Fetch detailed invoice information
  const fetchInvoiceDetails = async (docEntry) => {
    if (!docEntry) {
      setInvoiceDetails(null);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `http://localhost:3500/api/sap/invoices/${docEntry}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data && response.data.success) {
        setInvoiceDetails(response.data.data);
        console.log("✅ Invoice details loaded");
      }
    } catch (error) {
      console.error("Error fetching invoice details:", error);
      console.error("Error details:", error.response?.data);
    }
  };

  // Handle customer selection change
  const handleCustomerChange = (customerCode) => {
    setSelectedCustomer(customerCode);
    setSelectedInvoice("");
    setInvoiceDetails(null);
    if (customerCode) {
      fetchCustomerInvoices(customerCode);
    } else {
      setInvoices([]);
    }
  };

  // Format currency
  const formatCurrency = (amount, currency = "KES") => {
    return `${currency} ${Number(amount).toLocaleString("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Handle invoice selection change
  const handleInvoiceChange = (docEntry) => {
    setSelectedInvoice(docEntry);
    if (docEntry) {
      fetchInvoiceDetails(docEntry);
    } else {
      setInvoiceDetails(null);
    }
  };

  const loadPayment = async () => {
    try {
      setLoading(true);

      // First check if payment was passed via state
      if (location.state?.payment) {
        setPayment(location.state.payment);
        setPaymentAmount(location.state.payment.amount || "");
        setLoading(false);
        return;
      }

      // Otherwise fetch from API
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `http://localhost:3500/admin/payments/${id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      setPayment(response.data);
      setPaymentAmount(response.data.amount || "");
    } catch (err) {
      console.error("Error loading payment:", err);
      setError("Failed to load payment details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // UPDATED: Confirm payment function with proper status update
  const confirmPayment = async () => {
    if (!paymentAmount || isNaN(paymentAmount) || paymentAmount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (!selectedCustomer) {
      setError("Please select a customer from SAP");
      return;
    }

    setProcessing(true);
    setError("");

    try {
      const token = localStorage.getItem("token");

      const selectedCustomerData = customers.find(
        (c) => c.CardCode === selectedCustomer,
      );

      const selectedInvoiceData =
        selectedInvoice && selectedInvoice !== "none"
          ? invoices.find(
              (inv) => inv.DocEntry.toString() === selectedInvoice.toString(),
            )
          : null;

      console.log(
        "🚀 Creating incoming payment in SAP and confirming locally...",
      );

      // Get today's date in YYYY-MM-DD format
      const today = new Date();
      const paymentDate = today.toISOString().split("T")[0];
      const paymentAmountValue = parseFloat(paymentAmount);

      // Prepare ALL data for a single atomic backend call
      const sapPaymentData = {
        paymentId: id,
        cardCode: selectedCustomerData.CardCode,
        sapCustomerName: selectedCustomerData.CardName,
        amount: paymentAmountValue,
        docDate: paymentDate,
        remarks: `M-Pesa payment received from ${payment.number}. Receipt: ${payment.trnx_id}. Date: ${paymentDate}`,
        transactionId: payment.trnx_id,
        paymentMethod: "M-Pesa",
        sapInvoiceDocEntry: selectedInvoiceData?.DocEntry,
        sapInvoiceNumber: selectedInvoiceData?.DocNum,
        sapInvoiceTotal: selectedInvoiceData?.DocTotal,
      };

      // Add invoice linkage if invoice is selected
      if (selectedInvoiceData && selectedInvoice !== "none") {
        sapPaymentData.invoiceEntries = [
          {
            DocEntry: selectedInvoiceData.DocEntry,
            InvoiceType: "it_Invoice",
            SumApplied: paymentAmountValue,
          },
        ];
      }

      console.log("📤 Sending confirmation to backend:", sapPaymentData);

      const sapResponse = await axios.post(
        `http://localhost:3500/api/sap/incoming-payments`,
        sapPaymentData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          timeout: 120000,
        },
      );

      if (sapResponse.data.success) {
        console.log("✅ Payment confirmed and SAP record created!");

        const updatedPayment =
          sapResponse.data.updatedPayment || sapResponse.data.data;

        // Step 3: Show result
        const finalResult = {
          success: true,
          message: selectedInvoiceData
            ? `Payment confirmed and applied to SAP invoice successfully!`
            : `Payment confirmed and posted to SAP customer account successfully!`,
          data: updatedPayment,
          transactionId: payment.trnx_id,
          mpesa_receipt: payment.trnx_id,
          sap_customer_code: selectedCustomerData.CardCode,
          sap_customer_name: selectedCustomerData.CardName,
          applied_amount: paymentAmountValue,
          payment_date: paymentDate,
          confirmed_at: new Date().toISOString(),
          sap_invoice_number: selectedInvoiceData?.DocNum,
          sap_invoice_doc_entry: selectedInvoiceData?.DocEntry,
          sap_payment_result: sapResponse.data,
          sap_doc_num: sapResponse.data.sapDocNum,
          sap_doc_entry: sapResponse.data.sapDocEntry,
          payment_status: "paid",
          sap_status: "processed",
          notes: selectedInvoiceData
            ? `Payment KES ${paymentAmountValue.toLocaleString()} applied to Invoice #${
                selectedInvoiceData.DocNum
              } on ${paymentDate}. Payment marked as PAID.`
            : `Payment KES ${paymentAmountValue.toLocaleString()} posted to customer account on ${paymentDate}. Payment marked as PAID.`,
        };

        setResult(finalResult);
      } else {
        throw new Error(sapResponse.data.error || "SAP creation failed");
      }
    } catch (err) {
      console.error("Confirmation error:", err);

      let errorMessage = "Payment confirmation failed. Please try again.";
      let errorDetails = err.response?.data?.error || err.message;

      if (err.response?.status === 400) {
        errorMessage =
          "Validation error: " +
          (err.response.data.error || "Check your input data");
      }

      setResult({
        success: false,
        message: errorMessage,
        error: errorDetails,
      });
    } finally {
      setProcessing(false);
    }
  };

  const goBack = () => {
    navigate("/admin/payments");
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

  const formatAmount = (amount) => {
    return formatCurrency(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      if (dateString.includes("/Date(")) {
        const timestamp = parseInt(dateString.match(/\d+/)[0]);
        return new Date(timestamp).toLocaleDateString();
      }
      return new Date(dateString).toLocaleDateString();
    } catch (e) {
      return dateString;
    }
  };

  const formatSAPDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toISOString().split("T")[0];
    } catch (e) {
      console.error("Error formatting date:", e);
      return new Date().toISOString().split("T")[0];
    }
  };

  const formatSAPPhone = (phone) => {
    if (!phone) return "";
    const cleanPhone = phone.toString().replace(/\D/g, "");
    if (cleanPhone.startsWith("254")) {
      return cleanPhone;
    } else if (cleanPhone.startsWith("0")) {
      return `254${cleanPhone.substring(1)}`;
    }
    return cleanPhone;
  };

  // Auto-select customer based on phone number match
  useEffect(() => {
    if (payment && customers.length > 0) {
      const paymentPhone = formatSAPPhone(payment.number);

      const matchingCustomer = customers.find((customer) => {
        const customerPhone = formatSAPPhone(
          customer.Phone1 || customer.Cellular,
        );
        return customerPhone && customerPhone === paymentPhone;
      });

      if (matchingCustomer) {
        setSelectedCustomer(matchingCustomer.CardCode);
        fetchCustomerInvoices(matchingCustomer.CardCode);
      }
    }
  }, [payment, customers]);

  if (loading) {
    return (
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "30px" }}>
        <div style={{ textAlign: "center", padding: "60px" }}>
          <div className="spinner"></div>
          <p>Loading payment details...</p>
        </div>
      </div>
    );
  }

  if (!payment) {
    return (
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "30px" }}>
        <div style={{ textAlign: "center", padding: "60px" }}>
          <div style={{ fontSize: "48px", marginBottom: "20px" }}>🔍</div>
          <h3>Payment Not Found</h3>
          <p>
            The payment you're looking for doesn't exist or has been removed.
          </p>
          <button onClick={goBack} className="btn btn-primary">
            Back to Payments
          </button>
        </div>
      </div>
    );
  }

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
          margin: "0 auto",
          padding: "30px",
          backgroundColor: "white",
        }}
      >
        <div className="card">
          <div className="card-body">
            <h2 className="card-title">Pay</h2>

            {error && <div className="alert alert-danger">{error}</div>}

            {sapError && (
              <div className="alert alert-warning">
                <strong>Note:</strong> {sapError}
              </div>
            )}

            {!result ? (
              <>
                {/* Confirmation Form */}
                <div className="mb-3">
                  <div className="mb-3">
                    <label className="form-label fw-medium">Amount</label>
                    <input
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="form-control form-control-lg"
                      disabled={processing}
                      placeholder="Enter confirmation amount"
                      readOnly
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-medium">Customer</label>
                    {loadingCustomers ? (
                      <div
                        className="p-3 border rounded d-flex align-items-center"
                        style={{ gap: "8px" }}
                      >
                        <div className="spinner"></div>
                        <span>Loading customers from SAP...</span>
                      </div>
                    ) : customers.length === 0 ? (
                      <div className="text-center p-3 border rounded text-muted">
                        No customers available. Please check SAP connection.
                        <span>
                          <button
                            className="refresh"
                            onClick={fetchSAPCustomers}
                          >
                            Refresh
                          </button>
                        </span>
                      </div>
                    ) : (
                      <>
                        <select
                          value={selectedCustomer}
                          onChange={(e) => handleCustomerChange(e.target.value)}
                          className="form-select form-select-lg"
                          disabled={processing}
                        >
                          <option value="">*</option>
                          {customers.map((customer) => (
                            <option
                              key={customer.CardCode}
                              value={customer.CardCode}
                            >
                              {customer.CardName} ({customer.CardCode})
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>

                  {/* Invoice Selection */}
                  {selectedCustomer && (
                    <div className="mb-3">
                      <label className="form-label fw-medium">Invoice</label>
                      {loadingInvoices ? (
                        <div
                          className="p-3 border rounded d-flex align-items-center"
                          style={{ gap: "8px" }}
                        >
                          <div className="spinner"></div>
                          <span>Loading invoices from SAP...</span>
                        </div>
                      ) : invoices.length === 0 ? (
                        <div className="text-center p-3 border rounded text-muted">
                          No open invoices found for this customer.
                          <button
                            onClick={() =>
                              fetchCustomerInvoices(selectedCustomer)
                            }
                            className="btn btn-sm btn-link ms-2"
                          >
                            Retry
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="mb-3">
                            <select
                              value={selectedInvoice}
                              onChange={(e) =>
                                handleInvoiceChange(e.target.value)
                              }
                              className="form-select form-select-lg"
                              disabled={processing}
                            >
                              <option value="">*</option>
                              <option value="none">
                                No invoice - Apply to customer account
                              </option>
                              {invoices.map((invoice) => (
                                <option
                                  key={invoice.DocEntry}
                                  value={invoice.DocEntry}
                                >
                                  {invoice.DocNum}
                                </option>
                              ))}
                            </select>
                            <div className="form-text text-muted mb-3">
                              {invoices.length} open invoices found
                            </div>

                            {/* Balance Due Display */}
                            {selectedInvoice &&
                              (() => {
                                const inv = invoices.find(
                                  (i) =>
                                    i.DocEntry.toString() ===
                                    selectedInvoice.toString(),
                                );
                                if (inv) {
                                  const balanceVal = parseFloat(inv.Balance);
                                  const displayVal = isNaN(balanceVal)
                                    ? "0.00"
                                    : balanceVal.toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      });

                                  // Clean and parse DocTotal
                                  let totalVal = 0;
                                  if (inv.DocTotal) {
                                    const cleanTotal =
                                      inv.DocTotal.toString().replace(
                                        /[^0-9.-]/g,
                                        "",
                                      );
                                    totalVal = parseFloat(cleanTotal) || 0;
                                  }
                                  const displayTotal = totalVal.toLocaleString(
                                    undefined,
                                    {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    },
                                  );

                                  return (
                                    <div>
                                      <div className="mb-3">
                                        <label className="form-label fw-medium text-muted small text-uppercase">
                                          Total Amount
                                        </label>
                                        <div className="input-group">
                                          <input
                                            type="text"
                                            className="form-control fw-bold"
                                            value={displayTotal}
                                            readOnly
                                          />
                                        </div>
                                      </div>

                                      <div className="mb-3">
                                        <label className="form-label fw-medium text-muted small text-uppercase">
                                          Balance Due
                                        </label>
                                        <div className="input-group">
                                          <input
                                            type="text"
                                            className="form-control fw-bold color-danger"
                                            value={displayVal}
                                            readOnly
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Invoice Details */}
                  {invoiceDetails && (
                    <div className="mb-3 p-3 bg-success bg-opacity-10 rounded border-start border-success">
                      <h5 className="text-success mb-3">
                        <span className="me-2">📄</span>
                        Selected Invoice Details
                      </h5>
                      <div className="row">
                        <div className="col-md-6 mb-2">
                          <label className="text-muted small">
                            Invoice Number:
                          </label>
                          <div className="fw-medium">
                            #{invoiceDetails.DocNum}
                          </div>
                        </div>
                        <div className="col-md-6 mb-2">
                          <label className="text-muted small">
                            Issue Date:
                          </label>
                          <div>{formatDate(invoiceDetails.DocDate)}</div>
                        </div>
                        <div className="col-md-6 mb-2">
                          <label className="text-muted small">Due Date:</label>
                          <div className="fw-medium">
                            {formatDate(invoiceDetails.DocDueDate)}
                            {invoiceDetails.DaysOverdue > 0 && (
                              <span className="badge bg-danger ms-2">
                                {invoiceDetails.DaysOverdue} days overdue
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="col-md-6 mb-2">
                          <label className="text-muted small">
                            Invoice Amount:
                          </label>
                          <div className="fw-bold">
                            KES{" "}
                            {parseFloat(
                              invoiceDetails.DocTotal || 0,
                            ).toLocaleString()}
                          </div>
                        </div>
                        <div className="col-md-6 mb-2">
                          <label className="text-muted small">Status:</label>
                          <div>
                            <span
                              className={`badge ${
                                invoiceDetails.DocumentStatus === "O"
                                  ? "bg-warning"
                                  : "bg-secondary"
                              }`}
                            >
                              {invoiceDetails.DocumentStatus === "O"
                                ? "Open"
                                : invoiceDetails.DocumentStatus}
                            </span>
                          </div>
                        </div>
                        {invoiceDetails.Comments && (
                          <div className="col-md-12 mt-2">
                            <label className="text-muted small">
                              Comments:
                            </label>
                            <div className="small">
                              {invoiceDetails.Comments}
                            </div>
                          </div>
                        )}
                        {invoiceDetails.DocCurrency &&
                          invoiceDetails.DocCurrency !== "KES" && (
                            <div className="col-md-12 mt-2">
                              <div className="alert alert-warning py-2">
                                <small>
                                  <strong>Note:</strong> Invoice currency is{" "}
                                  {invoiceDetails.DocCurrency}. Payment will be
                                  converted using SAP exchange rates.
                                </small>
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="d-flex justify-content-center align-items-center pt-4 border-top">
                  <button
                    onClick={confirmPayment}
                    disabled={
                      processing ||
                      !selectedCustomer ||
                      !selectedInvoice ||
                      customers.length === 0
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    className="btn btn-success btn-lg"
                  >
                    {processing ? (
                      <>
                        <div className="spinner"></div>
                      </>
                    ) : (
                      <>Submit</>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-5">
                <div
                  className={`display-1 ${
                    result.success ? "text-success" : "text-danger"
                  }`}
                ></div>
                <h2 className={result.success ? "text-success" : "text-danger"}>
                  {result.success
                    ? "Payment Confirmed!"
                    : "Confirmation Failed"}
                </h2>
                <p className="lead text-muted mb-3">{result.message}</p>

                {result.success && (
                  <div className="card mb-3 text-start">
                    <div className="card-body">
                      <h4 className="card-title text-success">
                        Payment Confirmation Complete
                      </h4>

                      <div className="row mb-3">
                        <div className="col-md-6">
                          <label className="text-muted small">
                            STK Transaction ID
                          </label>
                          <div className="font-monospace text-primary">
                            {result.transactionId}
                          </div>
                        </div>
                        <div className="col-md-6">
                          <label className="text-muted small">
                            M-Pesa Receipt
                          </label>
                          <div className="font-monospace text-success">
                            {result.mpesa_receipt}
                          </div>
                        </div>
                      </div>

                      <div className="row mb-3">
                        <div className="col-md-6">
                          <label className="text-muted small">
                            SAP Customer
                          </label>
                          <div className="fw-medium">
                            {result.sap_customer_name} (
                            {result.sap_customer_code})
                          </div>
                        </div>
                        <div className="col-md-6">
                          <label className="text-muted small">
                            Payment Status
                          </label>
                          <div>
                            <span
                              className={`badge ${
                                result.payment_status === "paid"
                                  ? "bg-success"
                                  : result.payment_status === "sap_confirmed"
                                    ? "bg-warning"
                                    : "bg-secondary"
                              }`}
                            >
                              {result.payment_status === "paid"
                                ? "PAID"
                                : result.payment_status === "sap_confirmed"
                                  ? "SAP CONFIRMED"
                                  : result.payment_status || "CONFIRMED"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="row mb-3">
                        <div className="col-md-6">
                          <label className="text-muted small">
                            Confirmed At
                          </label>
                          <div>{formatDate(result.confirmed_at)}</div>
                        </div>
                        <div className="col-md-6">
                          <label className="text-muted small">
                            Amount Applied
                          </label>
                          <div className="fw-bold text-success">
                            KES {result.applied_amount.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {result.sap_invoice_number && (
                        <div className="row mb-3">
                          <div className="col-md-6">
                            <label className="text-muted small">
                              Applied to Invoice
                            </label>
                            <div className="fw-medium">
                              #{result.sap_invoice_number}
                            </div>
                          </div>
                          <div className="col-md-6">
                            <label className="text-muted small">
                              SAP Document Number
                            </label>
                            <div className="fw-medium text-primary">
                              #{result.sap_doc_num || "N/A"}
                            </div>
                          </div>
                        </div>
                      )}

                      {result.notes && (
                        <div className="alert alert-info mt-3">
                          <strong>Note:</strong> {result.notes}
                        </div>
                      )}

                      {result.warning && result.sap_error && (
                        <div className="alert alert-warning mt-3">
                          <strong>Important:</strong> Payment was confirmed
                          locally but SAP incoming payment creation failed.
                          Please manually create the incoming payment in SAP
                          Business One.
                          <br />
                          <br />
                          <strong>Details:</strong>{" "}
                          {result.sap_error.error ||
                            JSON.stringify(result.sap_error)}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="d-flex gap-1 justify-content-center">
                  <button onClick={goBack} className="btn btn-primary">
                    Back to Payments
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <style jsx>{`
          .spinner {
            width: 24px;
            height: 24px;
            border: 2px solid #f3f3f3;
            border-top: 2px solid #007bff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0;
          }
          .spinner-sm {
            width: 16px;
            height: 16px;
            border-width: 2px;
          }
          @keyframes spin {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }
          .card {
            margin: 50px auto;
            width: 80px;
            background: white;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          }
          .btn {
            width: 150px;
            display: inline-flex;
            align-items: center;
            padding: 10px 10px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 50;
          }
          .btn-primary {
            background-color: #007bff;
            color: white;
          }
          .btn-secondary {
            background-color: #6c757d;
            color: white;
          }
          .btn-success {
            background-color: #28a745;
            color: white;
          }
          .btn-danger {
            background-color: #dc3545;
            color: white;
          }
          .btn-warning {
            background-color: #ffc107;
            color: #212529;
          }
          .btn-lg {
            padding: 10px 20px;
            font-size: 16px;
            width: 100px;
          }
          .btn-sm {
            padding: 5px 10px;
            font-size: 12px;
          }
          .btn-outline-primary {
            background-color: transparent;
            border: 1px solid #007bff;
            color: #007bff;
          }
          .btn-outline-secondary {
            background-color: transparent;
            border: 1px solid #6c757d;
            color: #6c757d;
          }
          .btn-link {
            color: #007bff;
            text-decoration: underline;
            background: transparent;
            border: none;
            padding: 0;
          }
          .refresh {
            width: 80px;
          }
          .mb-2 {
            margin-bottom: 0.5rem;
          }
          .mb-3 {
            margin-bottom: 1rem;
          }
          .mb-4 {
            margin-bottom: 1.5rem;
          }
          .mb-5 {
            margin-bottom: 3rem;
          }
          .p-3 {
            padding: 1rem;
          }
          .p-4 {
            padding: 1.5rem;
          }
          .rounded {
            border-radius: 0rem;
          }
          .border {
            border: 1px solid #dee2e6;
          }
          .border-start {
            border-left: 4px solid;
          }
          .border-primary {
            border-left-color: #007bff;
          }
          .border-success {
            border-left-color: #28a745;
          }
          .text-muted {
            color: #000000ff;
          }
          .text-success {
            color: #28a745;
          }
          .text-danger {
            color: #dc3545;
          }
          .text-warning {
            color: #ffc107;
          }
          .bg-light {
            background-color: #f8f9fa;
          }
          .bg-dark {
            background-color: #212529;
          }
          .bg-success {
            background-color: #d4edda;
          }
          .bg-warning {
            background-color: #fff3cd;
          }
          .bg-opacity-10 {
            opacity: 0.1;
          }
          .alert {
            padding: 1rem;
            border-radius: 0.375rem;
            margin: 1rem 0 1rem 0;
          }
          .alert-danger {
            background-color: #f8d7da;
            color: #721c24;
          }
          .alert-warning {
            background-color: #fff3cd;
            color: #856404;
          }
          .alert-success {
            background-color: #d4edda;
            color: #155724;
          }
          .alert-info {
            background-color: #d1ecf1;
            color: #0c5460;
          }
          .font-monospace {
            font-family: monospace;
          }
          .fs-5 {
            font-size: 1.25rem;
          }
          .fw-medium {
            font-weight: 500;
          }
          .fw-bold {
            font-weight: bold;
          }
          .badge {
            display: inline-block;
            padding: 0.25em 0.4em;
            font-size: 75%;
            font-weight: 700;
            line-height: 1;
            text-align: center;
            white-space: nowrap;
            vertical-align: baseline;
            border-radius: 0.25rem;
          }
          .badge.bg-danger {
            background-color: #dc3545;
            color: white;
          }
          .badge.bg-warning {
            background-color: #ffc107;
            color: #212529;
          }
          .badge.bg-secondary {
            background-color: #6c757d;
            color: white;
          }
          .badge.bg-success {
            background-color: #28a745;
            color: white;
          }
          .form-label {
            margin-bottom: 0.5rem;
          }
          .form-control,
          .form-select {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid #dee2e6;
            border-radius: 0rem;
            font-size: 0.8rem;
            box-sizing: border-box;
          }
          .form-control-lg,
          .form-select-lg {
            padding: 0.75rem 1rem;
            font-size: 0.8rem;
          }
          .form-text {
            font-size: 0.875rem;
            color: #6c757d;
            margin-top: 0.25rem;
          }
          .d-flex {
            display: flex;
          }
          .flex-wrap {
            flex-wrap: wrap;
          }
          .justify-content-between {
            justify-content: space-between;
          }
          .justify-content-center {
            justify-content: center;
          }
          .align-items-center {
            align-items: center;
          }
          .gap-2 {
            gap: 0.5rem;
          }
          .gap-3 {
            gap: 1rem;
          }
          .ms-2 {
            margin-left: 0.5rem;
          }
          .me-2 {
            margin-right: 0.5rem;
          }
          .row {
            display: flex;
            flex-wrap: wrap;
            margin-right: -15px;
            margin-left: -15px;
          }
          .col-md-6 {
            flex: 0 0 50%;
            max-width: 50%;
            padding-right: 15px;
            padding-left: 15px;
          }
          .col-md-12 {
            flex: 0 0 100%;
            max-width: 100%;
            padding-right: 15px;
            padding-left: 15px;
          }
          .small {
            font-size: 0.875em;
          }
          .display-1 {
            font-size: 4rem;
            font-weight: 300;
            line-height: 1.2;
          }
          .lead {
            font-size: 1.25rem;
            font-weight: 300;
          }
          .py-2 {
            padding-top: 0.5rem;
            padding-bottom: 0.5rem;
          }
          .py-5 {
            padding-top: 3rem;
            padding-bottom: 3rem;
          }
          .pt-4 {
            padding-top: 1.5rem;
          }
          .border-top {
            border-top: 1px solid #dee2e6;
          }
        `}</style>
      </div>
    </div>
  );
};

export default ConfirmSTKPayment;
