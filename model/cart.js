import mongoose from "mongoose";

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
      max: [10, "Quantity cannot exceed 10"] 
    }
  },
  {
    timestamps: true
  }
);


cartSchema.index({ userId: 1, variantId: 1 }, { unique: true });


cartSchema.index({ userId: 1 });
cartSchema.index({ productId: 1 });

const Cart = mongoose.model("Cart", cartSchema);
export default Cart;
