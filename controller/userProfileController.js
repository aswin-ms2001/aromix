import express from "express";
import User from "../model/user.js";
import Product from "../model/product.js";
import Category from "../model/category.js"
import mongoose from "mongoose";
import { sendOtpEmail,sendOtpPassword } from "../utils/sendOtp.js";
import { otpGenerator } from "../utils/otpGenerator.js";
import bcrypt from "bcrypt";

export const userProfileFront = async (req,res)=>{
    try{
        const id = req.params.id;
        const user = await User.findById(id)
        res.render("user-views/user-account/user-profile/user-front.ejs",{user,activePage:"profile"})
    }catch(err){
        res.render("error.ejs");
    }
}

export const userPasswordOtp = async (req,res)=>{
    try{
        const id = req.params.id;
        const {current} = req.body;
        const user = await User.findById(id);
        
        if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
        }
        const valid = await user.comparePassword(current);
        if(!valid) return res.status(401).json({success:false,message:"The Password You given as Old password is invalid"})

        const email = user.email;
        const otp = otpGenerator();
        user.resetOtp = otp;
        user.resetOtpExpires = Date.now() + 60*1000;
        await user.save()
        await sendOtpPassword(email,otp);
        return res.status(200).json({ success: true, message: "OTP sent successfully" });
    }catch(err){
        console.error(err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
}

export const userPasswordVerification = async (req,res)=>{
    try{
        const id = req.params.id;
        const {otp,currentPassword, newPassword} = req.body;

        // console.log(otp,currentPassword, newPassword);
        const user = await User.findById(id);
        if(!user){
           return res.status(404).json({success:false,message:"User Not Found"});
        };
        if(currentPassword===newPassword){
            return res.status(409).json({success:false,message:"New password And Old Password are Same"});
        };
        if(user.resetOtpExpires < Date.now()) return res.status(410).json({success:false,message:"Otp Expired"});
        // console.log(user.resetOtp);
        // console.log(typeof otp);
        // console.log(typeof user.resetOtp);
        if(otp!=user.resetOtp) return res.status(400).json({success:false,message:"Invalid Otp"});
        // console.log("hai")
        const valid = await user.comparePassword(currentPassword);
        // console.log(valid);
        if(!valid) return res.status(401).json({success:false,message:"The Password you given as Old password is incorrect"});
        // console.log("wrong")
        user.password = await bcrypt.hash(newPassword,10);
        user.resetOtp = undefined;
        user.resetOtpExpires = undefined;
        await user.save();
        return res.status(200).json({success:true,message:"Password Updated Successfuly"})

    }catch(err){
        console.log(err);
        return res.status(500).json({success:false,message:"Server Error"});
    }
}