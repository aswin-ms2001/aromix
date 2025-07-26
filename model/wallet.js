import mongoose from "mongoose";

const walletSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Users", 
    required: true 
  },
  balance: { 
    type: Number, 
    default: 0,
    min: 0 
  },
  transactions: [
    {
      type: {
        type: String,
        enum: ["Credit", "Debit"],
        required: true
      },
      amount: {
        type: Number,
        required: true
      },
      description: {
        type: String,
        required: true
      },
      orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order"
      },
      date: {
        type: Date,
        default: Date.now
      }
    }
  ]
}, {
  timestamps: true
});

// Ensure one wallet per user
walletSchema.index({ userId: 1 }, { unique: true });

const Wallet = mongoose.model("Wallet", walletSchema);

export default Wallet;
