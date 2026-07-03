import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    user: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 4,
    },
    password: {
      type: String,
      required: true,
    },
    roles: {
      type: [String],
      default: ["Admin"],
    },
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
