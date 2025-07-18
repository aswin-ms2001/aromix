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
        console.log(otp);
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

export const userEmailVerification = async (req,res)=>{
    const id = req.params.id;
    const {email} = req.body;
    console.log(email)
    try{
        const user = await User.findById(id);
        if(!user) return res.status(404).json({success:false,message:"User Not Found"});
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({success:false,message:"Email is not valid"});
        const duplicate = await User.find({email});
        // console.log(unique);
        // console.log(unique[0]);
        // console.log(!unique[0]);
        if(duplicate[0]) return res.status(409).json({success:false,message:"Already Have an Account on this Email"});
        const otp = otpGenerator();
        console.log(otp);
        await sendOtpEmail(email,otp);
        user.otp = otp;
        user.otpExpires = Date.now()+ 60*1000;
        await user.save();
        return res.status(200).json({success:true,message:"Otp Send To Email"});
        
    }catch(err){
        return res.status(500).json({success:false,message:"Internal Server Error"});
    }

}

export const updateUserEmail = async (req,res)=>{
    const {otp,email} = req.body;
    const id = req.params.id;
    // console.log(otp,email,id)
    try{
        const user = await User.findById(id);
        // console.log(user)
        if(!user) return res.status(404).json({success:false,message:"User Not Found"});
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({success:false,message:"Email is not valid"});
        const duplicate = await User.find({email});
        if(duplicate[0]) return res.status(409).json({success:false,message:"Already Have an Account on this Email"});
        if(!/^\d{6}$/.test(otp)) return res.status(400).json({success:false,message:"Otp must be 6 digit"});
        if(otp.otpExpires < Date.now()) return res.status(410).json({success:false,message:"Otp Expired"})
        if(user.otp===otp && Date.now() < user.otpExpires ){
            user.email = email;
            user.otp = undefined;
            user.otpExpires = undefined;
            await user.save();
            return res.status(201).json({success:true,message:"Email Succesfully Updated"});
        }else{
            return res.status(400).json({success:false,message:"Wrong Otp"});
        }
        
    }catch(err){
        console.log(err)
        return res.status(500).json({success:false,message:"Something Went Wrong"})
    }
}

export const updateUserNameAndPhone = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const userId = req.params.id;


    if (!name || !phone) {
      return res.status(400).json({ success: false, message: "Name and phone number are required." });
    }


    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

  
    const toTitleCase = (str) => {
    return str
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .split(' ')
        .map(word =>
        word
            .split('.')
            .map(part => part ? part[0].toUpperCase() + part.slice(1) : '')
            .join('.')
        )
        .join(' ')
        .trim();
    };


    const formattedName = toTitleCase(name);

   
    const namePattern = /^[A-Za-z.\s]{3,40}$/;
    if (formattedName.length < 3) {
      return res.status(400).json({ success: false, message: "Name must be at least 3 characters." });
    }
    if (formattedName.length > 40) {
      return res.status(400).json({ success: false, message: "Name cannot exceed 40 characters." });
    }
    if (!namePattern.test(formattedName)) {
      return res.status(400).json({ success: false, message: "Name can only contain letters, spaces, and periods." });
    }


    const phonePattern = /^[0-9]{10}$/;
    if (!phonePattern.test(phone)) {
      return res.status(400).json({ success: false, message: "Phone number must be exactly 10 digits." });
    }

   
    const oldName = user.name.trim();
    const oldPhone = user.phoneNumber;

    if (oldName === formattedName && oldPhone === phone) {
      return res.status(200).json({ success: false, message: "No changes detected." });
    }

    
    user.name = formattedName;
    user.phoneNumber = phone;

    await user.save();
    
    return res.status(201).json({ success: true, message: "Profile updated successfully." });

  } catch (error) {
    console.error("Error updating profile:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};