import User from "../model/user.js";
import Product from "../model/product.js";
import Category from "../model/category.js"
import mongoose from "mongoose";
import Wishlist from "../model/wishlist.js";
import { isProductAndCategoryActive } from "./services/userServices/productActivityCheckingService.js";
import * as wishlistService from "./services/userServices/wishlistServices.js";

export const addToWishlist = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Invalid product ID format" });
    }
    if (!mongoose.Types.ObjectId.isValid(variantId)) {
      return res.status(400).json({ success: false, message: "Invalid variant ID format" });
    }


    const productObjectId = new mongoose.Types.ObjectId(productId);
    const variantObjectId = new mongoose.Types.ObjectId(variantId);


    const product = await Product.findOne({ _id: productObjectId, blocked: false })
      .populate({ path: "categoryId", select: "blocked" });

    if (!product) {
      return res.status(403).json({ success: false, message: "Product not found or blocked",redirect: "/users-products/discover" });
    }

    if (!product.categoryId || product.categoryId.blocked) {
      return res.status(403).json({ success: false, message: "Category is blocked" , redirect: "/users-products/discover"});
    }

  
    const variantExists = product.variants.some((variant) => variant._id.toString() === variantId);
    if (!variantExists) {
      return res.status(404).json({ success: false, message: "Variant does not exist for this product" });
    }

 
    const wishlistItem = await Wishlist.findOneAndUpdate(
      { userId, variantId: variantObjectId },
      { userId, productId: productObjectId, variantId: variantObjectId },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      success: true,
      message: "Item added to wishlist",
    });
  } catch (err) {
    console.error("❌ Error adding to wishlist:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};


export const deleteFromWishlist = async (req, res) => {
    try {
        const userId = req.user?._id;
        const { productId, variantId } = req.params;
        console.log("Entered")
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: "Invalid User ID" });
        }
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: "Invalid Product ID" });
        }
        if (!mongoose.Types.ObjectId.isValid(variantId)) {
            return res.status(400).json({ success: false, message: "Invalid Variant ID" });
        }

        const active = await isProductAndCategoryActive(productId);
        if (!active) {
          console.log("blocked")
            return res.status(403).json({
                success: false,
                message: "Item is blocked",
                redirect: "/users-products/discover"
            });
        }

        const deleted = await wishlistService.removeFromWishlist(userId, productId, variantId);
        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: "Item not found in wishlist"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Item deleted from wishlist"
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

export const userWishlist = async (req,res)=>{
  try{
    const userId = req.user._id;
    const wishlist = await wishlistService.getUserWishlistFunction(userId);
    return res.render("user-views/user-account/user-profile/user-wishlist.ejs",{
      wishlist,
      activePage: "wishlist"
    });
  }catch(err){
    console.log(err);
    return res.render("error")
  }
}