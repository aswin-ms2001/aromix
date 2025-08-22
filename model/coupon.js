import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 6,
    maxlength: 12,
    match: [/^[A-Za-z0-9]{6,12}$/, "Coupon code must be 6-12 alphanumeric characters"],
  },
  type: {
    type: String,
    enum: ["PERCENTAGE", "FLAT"],
    required: true,
  },
  discount: {
    type: Number,
    required: true,
    min: 1,
  },
  minAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  maxAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  startAt: {
    type: Date,
    required: true,
  },
  endAt: {
    type: Date,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: false,
  },
  isNonBlocked: {
    type: Boolean,
    default: true,
  },
  usedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users"
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    default: null
  }
}, {
  timestamps: true,
});

const Coupon = mongoose.model("Coupon", couponSchema);
export default Coupon;
