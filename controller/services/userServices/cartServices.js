import User from "../../../model/user.js";
import Product from "../../../model/product.js";
import Category from "../../../model/category.js"
import mongoose from "mongoose";
import Cart from "../../../model/cart.js";
import { getVariantStock } from "./productActivityCheckingService.js";

export const addToUserCart = async (userId, productId, variantId) => {
  try {
  
    let cartItem = await Cart.findOne({ userId, variantId });
    const stockQuantity = await getVariantStock(productId, variantId)
    if (cartItem) {
     
      if (cartItem.quantity < 10) {
        if(cartItem.quantity + 1 > stockQuantity) return {success:false,message:`Cannot Add to cart, Only ${stockQuantity} left`}
        cartItem.quantity += 1;
        await cartItem.save();
        return { success: true, message: "Quantity updated", cartItem };
      } else {
        return { success: false, message: "Maximum quantity (10) reached" };
      }
    } else {
      if(stockQuantity===0){
        return {success:false,message:`Product Out of Stock`}
      }
      const newCartItem = await Cart.create({
        userId,
        productId,
        variantId,
        quantity: 1
      });

      return { success: true, message: "Item added to cart", cartItem: newCartItem };
    }
  } catch (error) {
    console.error("Error adding to cart:", error);
    return { success: false, message: "Server error" };
  }
};



export const getUserCartFunction = async (userId) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return { cartItems: [], subtotal: 0 };
    }

    const cartItems = await Cart.find({ userId })
      .populate({
        path: "productId",
        select: "name blocked categoryId variants",
        populate: {
          path: "categoryId",
          select: "name blocked"
        }
      })
      .lean();

  
    const activeCart = cartItems.filter(item => {
      const product = item.productId;
      if (!product || product.blocked) return false;
      if (product.categoryId && product.categoryId.blocked) return false;
      return true;
    }).map(item => {
      const product = item.productId;


      const variant = product.variants.find(
        v => v._id.toString() === item.variantId.toString()
      );

      
      const itemTotal = variant ? variant.price * item.quantity : 0;

      return {
        _id: item._id,
        userId: item.userId,
        createdAt: item.createdAt,
        quantity: item.quantity,
        productId: {
          _id: product._id,
          name: product.name,
          categoryId: product.categoryId
        },
        variant: variant ? {
          _id: variant._id,
          price: variant.price,
          stock: variant.stock,
          images: variant.images,
          volume: variant.volume
        } : null,
        itemTotal
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

 
    const subtotal = activeCart.reduce((sum, item) => sum + item.itemTotal, 0);

    return { cartItems: activeCart, subtotal };

  } catch (err) {
    console.error("Error fetching user cart:", err);
    return { cartItems: [], subtotal: 0 };
  }
};