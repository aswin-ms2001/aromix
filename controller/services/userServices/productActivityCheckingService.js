import Product from "../../../model/product.js";
import mongoose from "mongoose";

export const isProductAndCategoryActive = async (productId) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return false;
  }

  const product = await Product.findOne({ _id: productId }).populate({
    path: "categoryId",
    select: "blocked"
  });

  if (!product) return false;
  if (product.blocked) return false;
  if (product.categoryId && product.categoryId.blocked) return false;

  return true;
};


export const getVariantStock = async (productId, variantId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(variantId)) {
      return 0; 
    }


    const product = await Product.findOne(
      { _id: productId, "variants._id": variantId },
      { "variants.$": 1 }
    ).lean();

    if (!product || !product.variants || product.variants.length === 0) {
      return 0;
    }

    return product.variants[0].stock || 0; 
  } catch (err) {
    console.error("Error fetching stock:", err);
    return 0; 
  }
};
