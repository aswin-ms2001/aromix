import express from "express";
import Cart from "../model/cart.js";
import Product from "../model/product.js";
import Address from "../model/address.js";
import Order from "../model/oder.js";
import mongoose, { Mongoose } from "mongoose";
import { productDetails } from "./adminController.js";
import { isProductAndCategoryActive ,getVariantStock } from "./services/userServices/productActivityCheckingService.js";
import * as cartService from "./services/userServices/cartServices.js";
import currentUser from "../middleware/userIdentification/currentUser.js";


export const userCheckOut = async (req,res)=>{
    try {
        const userId = req.user._id;
        const {cartItems,subtotal} = await cartService.getUserCartFunction(userId);
        if(!cartItems[0]) return res.redirect("/users-cart/user-cart-front")
        const addresses = await Address.find({userId}).sort({isDefault:-1,createdAt:-1}).lean();
        const defaultAddress = addresses.find(addr => addr.isDefault)|| null;
        return res.render("user-views/user-checkout/checkout.ejs",{
            cart:cartItems,
            subtotal,
            addresses,
            defaultAddress
        })
    } catch(err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
}

export const userOrder = async (req, res) => {
  try {
    const userId = req.user._id;
    const { cart, selectedAddressId, paymentMethod } = req.body;

    // 1. Validate payment method
    if (paymentMethod !== "cod") {
      return res.status(400).json({ success: false, message: "Only Cash On Delivery is Applicable" });
    }

    // 2. Validate address
    const address = await Address.findById(selectedAddressId);
    if (!address) {
      return res.status(404).json({ success: false, message: "Address Not Found" });
    }

   
    const { cartItems, subtotal } = await cartService.getUserCartFunction(userId);
    if (!cartItems.length) {
      return res.status(400).json({ success: false, message: "Cart is Empty" });
    }

    // 4. Validate user cart IDs vs DB cart IDs
    const userVariantIds = cart.map(item => String(item.variant._id)).sort();
    const dbVariantIds = cartItems.map(item => String(item.variant._id)).sort();

    const allMatch =
      userVariantIds.length === dbVariantIds.length &&
      userVariantIds.every((id, index) => id === dbVariantIds[index]);

    if (!allMatch) {
      return res.status(400).json({ success: false, message: "Admin modified your cart items. Please refresh your cart." });
    }

    // 5. Check stock availability
    const outOfStockItems = [];
    for (let item of cartItems) {
      const stock = await getVariantStock(item.productId._id, item.variant._id);
      if (stock < item.quantity) {
        outOfStockItems.push(`${item.productId.name} (${item.variant.volume}ml)`);
      }
    }

    if (outOfStockItems.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Some items are out of stock",
        outOfStockItems
      });
    }

    // 6. Prepare Order Items
    const orderItems = cartItems.map(item => ({
      productId: item.productId._id,
      variantId: item.variant._id,
      quantity: item.quantity,
      basePrice: item.variant.price,
      discountAmount: 0, // If any discounts, calculate here
      finalPrice: item.variant.price, // No discount applied
      total: item.variant.price * item.quantity,
      appliedOffer: null
    }));

    // 7. Calculate totals
    const discount = 0; // Apply coupon logic if needed
    const shippingCharge = subtotal >1000 ? 0 :  50; // Add shipping logic if needed
    const grandTotal = subtotal - discount + shippingCharge;

    // 8. Create Order
    const order = new Order({
      userId,
      items: orderItems,
      address: {
        name: address.name,
        house: address.house,
        street: address.street,
        city: address.city,
        state: address.state,
        country: address.country,
        pincode: address.pincode,
        mobile: address.mobile
      },
      paymentMethod: "COD",
      paymentStatus: "Pending",
      orderStatus: "Pending",
      subtotal,
      discount,
      shippingCharge,
      grandTotal,
      appliedCoupon: null
    });

    await order.save();

    // 9. Reduce stock for each variant
    for (let item of cartItems) {
      await Product.updateOne(
        { _id: item.productId._id, "variants._id": item.variant._id },
        { $inc: { "variants.$.stock": -item.quantity } }
      );
    }

    // 10. Clear user cart
    await Cart.deleteMany({userId});

    return res.status(200).json({
      success: true,
      message: "Order placed successfully",
      orderId: order._id,
      redirect:`/user-oder/oder-status/${order._id}`
    });

  } catch (err) {
    console.error("Error in userOrder:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};


export const userOrderSuccessPage = async (req,res)=>{
    try{
        const id = req.params.id;
        const order = await Order.findById(id); 
        if(!order || String(order.userId) !== String(req.user._id)) {
            return res.render("error.ejs");
        }
        return res.render("user-views/user-account/user-profile/user-success.ejs",{
            order
        })
    }catch(err){
        console.log(err);
        return res.render("error.ejs")
    }
}


export const orderFrontPage = async (req,res)=>{
    try{
        const userId = req.user._id;
        const order = await Order.find({userId});
        return res.render("",{
            order,
            activePage:"order",
            
        })

    }catch(err){
        console.log(err);
        return res.render("error.ejs");
    }
}