import User from "../model/user.js";
import Product from "../model/product.js";
import Category from "../model/category.js"
import mongoose from "mongoose";
import Wishlist from "../model/wishlist.js";
import { isProductAndCategoryActive } from "./services/userServices/productActivityCheckingService.js";
import * as wishlistService from "./services/userServices/wishlistServices.js";
import { HTTP_STATUS } from "../utils/httpStatus.js";

/**
 * @async
 * @function addToWishlist
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
export const addToWishlist = async (req, res) => {
  try {
    const { productId, variantId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: "Invalid product ID format" });
    }
    if (!mongoose.Types.ObjectId.isValid(variantId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: "Invalid variant ID format" });
    }


    const productObjectId = new mongoose.Types.ObjectId(productId);
    const variantObjectId = new mongoose.Types.ObjectId(variantId);


    const product = await Product.findOne({ _id: productObjectId, blocked: false })
      .populate({ path: "categoryId", select: "blocked" });

    if (!product) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({ success: false, message: "Product not found or blocked",redirect: "/users-products/discover" });
    }

    if (!product.categoryId || product.categoryId.blocked) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({ success: false, message: "Category is blocked" , redirect: "/users-products/discover"});
    }

  
    const variantExists = product.variants.some((variant) => variant._id.toString() === variantId);
    if (!variantExists) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: "Variant does not exist for this product" });
    }

 
    const wishlistItem = await Wishlist.findOneAndUpdate(
      { userId, variantId: variantObjectId },
      { userId, productId: productObjectId, variantId: variantObjectId },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Item added to wishlist",
    });
  } catch (err) {
    console.error("❌ Error adding to wishlist:", err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Internal server error"
    });
  }
};


/**
 * @async
 * @function deleteFromWishlist
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
export const deleteFromWishlist = async (req, res) => {
    try {
        const userId = req.user?._id;
        const { productId, variantId } = req.params;
 
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: "Invalid User ID" });
        }
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: "Invalid Product ID" });
        }
        if (!mongoose.Types.ObjectId.isValid(variantId)) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: "Invalid Variant ID" });
        }

        const active = await isProductAndCategoryActive(productId);
        if (!active) {
          
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                success: false,
                message: "Item is blocked",
                redirect: "/users-products/discover"
            });
        }

        const deleted = await wishlistService.removeFromWishlist(userId, productId, variantId);
        if (!deleted) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({
                success: false,
                message: "Item not found in wishlist"
            });
        }

        return res.status(HTTP_STATUS.OK).json({
            success: true,
            message: "Item deleted from wishlist"
        });

    } catch (err) {
        console.error(err);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal Server Error" });
    }
};

/**
 * @async
 * @function userWishlist
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
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