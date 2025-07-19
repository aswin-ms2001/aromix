import mongoose from "mongoose";

const wishlistSchema = new mongoose.Schema(
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
    }
  },
  {
    timestamps: true
  }
);

wishlistSchema.index({ userId: 1, variantId: 1 }, { unique: true });
wishlistSchema.index({ userId: 1 });   
wishlistSchema.index({ productId: 1 })

const Wishlist = mongoose.model("Wishlist", wishlistSchema);
export default Wishlist;
