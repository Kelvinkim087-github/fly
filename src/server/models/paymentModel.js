import mongoose from "mongoose";
const { Schema } = mongoose;

const paymentSchema = new Schema(
	{
		number: { type: String },
		trnx_id: { type: String },
		amount: { type: Number },
		checkoutRequestID: { type: String, unique: true, sparse: true },
		merchantRequestID: { type: String },
		status: { type: String, default: "pending" }, // pending, paid, failed, sap_confirmed
		sapStatus: { type: String, default: "pending" }, // pending, processed, failed

		// SAP Confirmation Info
		sapConfirmed: { type: Boolean, default: false },
		sapConfirmedAt: { type: Date },
		sapCustomerCode: { type: String },
		sapCustomerName: { type: String },
		sapInvoiceDocEntry: { type: Number },
		sapInvoiceNumber: { type: String },
		sapInvoiceTotal: { type: Number },
		confirmedAmount: { type: Number },
		confirmedBy: { type: String },
		confirmationNotes: { type: String },
		paymentMethod: { type: String },

		// SAP Incoming Payment Info
		sapDocEntry: { type: Number },
		sapDocNum: { type: String },
		sapPaymentCreated: { type: Boolean, default: false },
		sapPaymentCreatedAt: { type: Date },
		sapPaymentData: { type: Schema.Types.Mixed },

		// History
		confirmationHistory: [{
			confirmedAt: { type: Date },
			confirmedBy: { type: String },
			customerCode: { type: String },
			customerName: { type: String },
			invoiceNumber: { type: String },
			amount: { type: Number },
			notes: { type: String }
		}],
		paymentHistory: [{
			action: { type: String },
			at: { type: Date },
			by: { type: String },
			sapDocNum: { type: String },
			sapDocEntry: { type: Number },
			notes: { type: String }
		}],

		raw: { type: Schema.Types.Mixed },
	},
	{ timestamps: true }
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
