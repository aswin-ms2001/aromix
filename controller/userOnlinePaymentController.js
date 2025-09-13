import express from "express";
import Cart from "../model/cart.js";
import Product from "../model/product.js";
import Address from "../model/address.js";
import Order from "../model/oder.js";
import mongoose, { Mongoose } from "mongoose";
import { productDetails } from "./adminController.js";
import { isProductAndCategoryActive, getVariantStock } from "./services/userServices/productActivityCheckingService.js";
import * as cartService from "./services/userServices/cartServices.js";
import currentUser from "../middleware/userIdentification/currentUser.js";
import PDFDocument from "pdfkit";
import { userCoupens, coupenDetails } from "./services/userServices/coupenService.js";
import Coupon from "../model/coupon.js";
import { createRazorpayOrder, verifyRazorpaySignature } from "./services/paymentServices/paymentServices.js";

export const createRazorpayOrderForUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const { cart, selectedAddressId, paymentMethod, coupon } = req.body;
   
    // 1. Validate payment method
   
    if (paymentMethod !== "razorpay") {
      return res.status(400).json({ success: false, message: "Razorpay is not Selected" });
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
 
    let appliedCoupon = null;
    if (coupon) {
      appliedCoupon = await coupenDetails(coupon, subtotal, userId);
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

    var couponAmount = 0;
    if (appliedCoupon) {
      if (appliedCoupon.type === "PERCENTAGE") {
        couponAmount = appliedCoupon.discount * subtotal/100;
      } else {
        couponAmount = appliedCoupon.discount;
      }
    } else {
      couponAmount = 0
    }
    // 6. Prepare Order Items
    const orderItems = cartItems.map((item) => {

      const itemCouponDis = (item.itemTotal / subtotal) * couponAmount;
      const roundedItemDis = Math.round(itemCouponDis);
      const discountPerUnit = roundedItemDis / item.quantity;
      return {
        productId: item.productId._id,
        variantId: item.variant._id,
        quantity: item.quantity,
        basePrice: item.variant.basePrice,
        discountAmount: discountPerUnit, // coupon discount per item
        finalPrice: item.variant.price - discountPerUnit, // No discount applied
        total: item.variant.price * item.quantity - roundedItemDis,
        appliedOffer: appliedCoupon ? appliedCoupon.code : null, //coupon offer id
      }
    }

    );

    // 7. Calculate totals
    const discount = couponAmount; // Apply coupon logic if needed
    const shippingCharge = subtotal > 1000 ? 0 : 50; // Add shipping logic if needed
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
      paymentMethod: "RAZORPAY",
      paymentStatus: "Pending",
      orderStatus: "Pending",
      subtotal,
      discount,
      shippingCharge,
      grandTotal,
      appliedCoupon: appliedCoupon ? appliedCoupon.code : null
    });

    await order.save();

 
    const razorpayOrder = await createRazorpayOrder(grandTotal, order.orderId.toString())
 
    // 9. Reduce stock for each variant
    for (let item of cartItems) {
      await Product.updateOne(
        { _id: item.productId._id, "variants._id": item.variant._id },
        { $inc: { "variants.$.stock": -item.quantity } }
      );
    }
    if (appliedCoupon) {
      await Coupon.updateOne({ code: appliedCoupon.code }, {
        $addToSet: { usedBy: userId }
      })
    };

    // 10. Clear user cart
    await Cart.deleteMany({userId});
 
    return res.status(200).json({
      success: true,
      order: razorpayOrder,
      tempOrderId: order._id
    });

  } catch (err) {
    console.error("Error in userOrder:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};


export const verifyRazorpayPayment = async (req, res) => {
  try {
    const { orderId, paymentId, signature, tempOrderId } = req.body;


    const order = await Order.findById(tempOrderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (!verifyRazorpaySignature(orderId, paymentId, signature)) {
      console.log("failee")
      order.paymentStatus = "Failed";
      await order.save();
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }

    order.paymentStatus = "Paid";
    order.razorpayPaymentId = paymentId;
    order.orderStatus = "Pending";
    await order.save();

    res.json({ success: true, message: "Payment successful", orderId: order._id });
  } catch (err) {
    console.error("Error in verifyRazorpayPayment:", err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};


export const updateOrderFailedStatus = async (req,res)=>{
  try{
    const id = req.params.id;

    const order = await Order.findById(id);
    if(!order) return res.status(404).json({success:false});
    order.paymentStatus = "Failed";
    await order.save();
    return res.status(200).json({success:true});
  }catch(err){
    console.log(err);
    return res.status(404).json({success:false});
  }
}

export const userOrderFailurePage = async(req,res)=>{
  try{
      const id = req.params.id;

      const order = await Order.findById(id); 
      if(!order || String(order.userId) !== String(req.user._id)) {
          return res.render("error.ejs");
      }
      
      return res.render("user-views/user-account/user-profile/user-failed.ejs",{
          order
      })
  }catch(err){
      console.log(err);
      return res.render("error.ejs")
  }
};

export const retryPayment = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    if (order.paymentMethod !== "RAZORPAY") {
      return res.status(400).json({ success: false, message: "Only Razorpay orders can be retried" });
    }
    if (order.paymentStatus !== "Failed") {
      return res.status(400).json({ success: false, message: "Only failed payments can be retried" });
    }

    // Create new Razorpay order
    const razorpayOrder = await createRazorpayOrder(order.grandTotal, order.orderId.toString());

    return res.json({ success: true, razorpayOrder, order });
  } catch (err) {
    console.error("Error retrying payment:", err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};