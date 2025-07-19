import User from "../../../model/user.js";
import Product from "../../../model/product.js";
import Category from "../../../model/category.js"
import Wishlist from "../../../model/wishlist.js";
import mongoose from "mongoose";

export const getWishlistVariantIds = async (userId, productId) => {
  try {
    const wishlist = await Wishlist.find(
      { userId, productId },
      { variantId: 1, _id: 0 } 
    );

    return wishlist.map(item => item.variantId.toString());
  } catch (err) {
    console.error("Error fetching wishlist variant IDs:", err);
    return [];
  }
};


export const removeFromWishlist = async (userId, productId, variantId) => {
  try {

    if (!mongoose.Types.ObjectId.isValid(userId) ||
        !mongoose.Types.ObjectId.isValid(productId) ||
        !mongoose.Types.ObjectId.isValid(variantId)) {
      return false;
    }

    const result = await Wishlist.findOneAndDelete({ userId, productId, variantId });
    return !!result; 
  } catch (err) {
    return false; 
  }
};

export const getUserWishlistFunction = async (userId) => {
  try {

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return [];
    }


    const wishlist = await Wishlist.find({ userId })
      .populate({
        path: "productId",
        select: "name blocked categoryId variants",
        populate: {
          path: "categoryId",
          select: "name blocked" 
        }
      })
      .lean();

  
    const activeWishlist = wishlist.filter(item => {
      const product = item.productId;
      if (!product || product.blocked) return false;
      if (product.categoryId && product.categoryId.blocked) return false;
      return true;
    }).map(item => {
        const product = item.productId;
        const variant = product.variants.find(
          v => v._id.toString() === item.variantId.toString()
        );

        return {
          _id: item._id,
          userId: item.userId,
          createdAt: item.createdAt,
          productId: {
            _id: product._id,
            name: product.name,
            categoryId: product.categoryId, 
          },
          variant: variant || null, 
        };
      }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return activeWishlist;
  } catch (err) {
    console.error("Error fetching user wishlist:", err);
    return [];
  }
};