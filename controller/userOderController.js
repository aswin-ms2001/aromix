import express from "express";
import Cart from "../model/cart.js";
import Product from "../model/product.js";
import Address from "../model/address.js";
import mongoose from "mongoose";
import { productDetails } from "./adminController.js";
import { isProductAndCategoryActive } from "./services/userServices/productActivityCheckingService.js";
import * as cartService from "./services/userServices/cartServices.js";


export const userCheckOut = async (req,res)=>{
    try {
        const userId = req.user._id;
        const {cartItems,subtotal} = await cartService.getUserCartFunction(userId);

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