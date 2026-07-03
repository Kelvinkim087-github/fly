import mongoose from "mongoose";

const tokenBlacklistSchema = new mongoose.Schema({
	token: {
		type: String,
		required: true,
		unique: true,
	},
	expiresAt: {
		type: Date,
		required: true,
	},
	blacklistedAt: {
		type: Date,
		default: Date.now,
	},
	user: {
		type: String,
		required: false,
	},
});

// Create TTL index to auto-delete expired tokens
tokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Create index for faster queries
tokenBlacklistSchema.index({ token: 1 });

export default mongoose.model("TokenBlacklist", tokenBlacklistSchema);
