import express from "express";
import Cart from "../model/cart.js";
import Product from "../model/product.js";
import mongoose from "mongoose";
import { productDetails } from "./adminController.js";
import { isProductAndCategoryActive } from "./services/userServices/productActivityCheckingService.js";
import { removeFromWishlist } from "./services/userServices/wishlistServices.js";
import * as cartService from "./services/userServices/cartServices.js";

export const userCartFront = async (req,res)=>{
    try{
        const userId = req.user._id;
        const {cartItems,subtotal} = await cartService.getUserCartFunction(userId);
        console.log(cartItems,subtotal);
        return res.render("user-views/user-account/user-profile/user-cart.ejs",{
          cart:cartItems,
          subtotal,
          activePage:'cart'
        })
    }catch(err){
      console.log(err)
      return res.render("error.ejs")
    }
}


export const addToCart = async (req, res) => {
  try {
    const { variantId, productId } = req.params;
    const userId = req.user._id;

    const isActive = await isProductAndCategoryActive(productId);
    if (!isActive) {
      return res.status(403).json({
        success: false,
        message: "This product or its category is blocked",
        redirect : "/users-products/discover"
      });
    }


    const cartResult = await cartService.addToUserCart(userId, productId, variantId);

    if (!cartResult.success) {
      
      if (cartResult.message.includes("Maximum quantity")) {
        return res.status(400).json(cartResult); 
      }else if(cartResult.message.includes("Cannot Add") || cartResult.message.includes("Product Out")){
        return res.status(409).json(cartResult);
      } else {
        return res.status(500).json(cartResult); 
      }
    }

    return res.status(200).json(cartResult);

  } catch (err) {
    console.error("Error in addToCart:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};


export const addToCartDeleteFromWishlist = async (req, res) => {
  try {
    const { productId, variantId } = req.body;
    const userId = req.user._id;

    const isActive = await isProductAndCategoryActive(productId);
    if (!isActive) {
      return res.status(403).json({
        success: false,
        message: "This product or its category is blocked",
        redirect: "/users-products/discover"
      });
    }

    const cartResult = await cartService.addToUserCart(userId, productId, variantId);

 
    if (!cartResult.success) {
      if (cartResult.message.includes("Maximum quantity")) {
        
        const wishlistResult = await removeFromWishlist(userId, productId, variantId);

        if (!wishlistResult) {
          return res.status(409).json({
            success: false,
            message: "Max quantity reached. Also failed to remove from wishlist. Please remove manually.",
            cartStatus: "failed",
            wishlistStatus: "failed"
          });
        }

        return res.status(409).json({
          success: false,
          message: "Max quantity reached. Removed from wishlist.",
          cartStatus: "failed",
          wishlistStatus: "removed"
        });
      }


      return res.status(500).json(cartResult);
    }


    const wishlistResult = await removeFromWishlist(userId, productId, variantId);

    if (!wishlistResult) {
      return res.status(207).json({
        success: true,
        partialSuccess: true,
        message: "Added to cart, but failed to remove from wishlist. Please remove manually.",
        cartStatus: "added",
        wishlistStatus: "failed"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Item moved to cart successfully."
    });

  } catch (err) {
    console.error("Error in addToCartDeleteFromWishlist:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while moving item to cart"
    });
  }
};

export const updateCartQuantity = async (req, res) => {
  try {
    const { action } = req.body;
    const userId = req.user._id;
    const cartId = req.params.cartId;

    if (!["increment", "decrement"].includes(action)) {
      return res.status(400).json({ success: false, message: "Invalid action" });
    }

   
    const cartItem = await Cart.findById(cartId).populate({
      path: "productId",
      select: "blocked categoryId variants",
      populate: { path: "categoryId", select: "blocked" }
    });

    if (!cartItem) {
      return res.status(404).json({ success: false, message: "Cart item not found" });
    }

   
    if (cartItem.productId.blocked || (cartItem.productId.categoryId && cartItem.productId.categoryId.blocked)) {
      return res.status(403).json({
        success: false,
        message: "Product or Category is Blocked",
        redirect: "/users-products/discover"
      });
    }

    
    const variant = cartItem.productId.variants.id(cartItem.variantId);
    if (!variant) {
      return res.status(404).json({ success: false, message: "Variant not found" });
    }

    let newQuantity = cartItem.quantity;


    if (action === "increment") {
      if (newQuantity >= 10) {
        return res.status(400).json({ success: false, message: "Max quantity limit reached" });
      }
      if (newQuantity + 1 > variant.stock) {
        return res.status(400).json({ success: false, message: "Only " + variant.stock + " left in stock" });
      }
      newQuantity++;
    } else if (action === "decrement") {
      if (newQuantity <= 1) {
        return res.status(400).json({ success: false, message: "Quantity cannot be less than 1" });
      }
      newQuantity--;
    }

    
    cartItem.quantity = newQuantity;
    await cartItem.save();

    const itemTotal = variant.price * newQuantity;

    
    const userCart = await Cart.find({ userId }).populate({
      path: "productId",
      select: "variants blocked categoryId",
      populate: {
        path:"categoryId",
        select:"blocked"
      }

    });

    let subtotal = 0;
    for (const item of userCart) {
      console.log(item)
      if(item.productId.blocked||item.productId.categoryId.blocked){
        continue;
      }
      const cartVariant = item.productId.variants.id(item.variantId);
      if (cartVariant) {
        subtotal += cartVariant.price * item.quantity;
      }
    }

    return res.json({
      success: true,
      quantity: newQuantity,
      itemTotal,
      subtotal,
      stock: variant.stock,
      message: "Quantity Updated"
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};


export const deleteCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const cartId = req.params.cartId;

   
    const cartItem = await Cart.findById(cartId);
    if (!cartItem) {
      return res.status(404).json({ success: false, message: "Cart item not found" });
    }


    if (cartItem.userId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized access" });
    }

   
    const isActive = await isProductAndCategoryActive(cartItem.productId);
    if (!isActive) {
      return res.status(403).json({
        success: false,
        message: "Product or Category is Blocked",
        redirect: "/users-products/discover"
      });
    }


    await Cart.findByIdAndDelete(cartId);

    
    const userCart = await Cart.find({ userId }).populate({
      path: "productId",
      select: "variants blocked categoryId",
      populate: {
        path: "categoryId",
        select: "blocked"
      }
    });

    let subtotal = 0;
    for (const item of userCart) {
      if (item.productId.blocked || item.productId.categoryId.blocked) {
        continue;
      }
      const variant = item.productId.variants.id(item.variantId);
      if (variant) {
        subtotal += variant.price * item.quantity;
      }
    }

    
    return res.status(200).json({
      success: true,
      message: "Item removed from cart",
      subtotal,
      delivery: subtotal > 1000 ? 0 : 50,
      grandTotal: subtotal > 1000 ? subtotal : subtotal + 50,
      remainingItems: userCart.length
    });

  } catch (err) {
    console.error("Error removing cart item:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
