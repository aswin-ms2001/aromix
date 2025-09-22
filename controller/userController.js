import express from "express";
import User from "../model/user.js";
import passport from "../config/passport.js";
import bcrypt from "bcrypt";
import { sendOtpEmail, sendOtpPassword } from "../utils/sendOtp.js";
import generateReferralCode from "../utils/referalGenerator.js"
import Product from "../model/product.js";
import Wallet from "../model/wallet.js";
import { productActiveOfferLinker } from "./services/userServices/userOfferService.js";

export const userloginPage = (req,res)=>{
    const errorMessage = req.flash("error")
    res.render("user-views/login.ejs",{
      errorMessage
    })
}

export const postLogin = passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/users/login',
    failureFlash: true,
});

export const logout = (req, res) => {
  
  if (!req.isAuthenticated()) {
    return res.redirect('/users/login');
  }

  req.logout(err => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).send('Logout failed');
    }

    req.session.destroy(err => {
      if (err) {
        console.error("Session destroy error:", err);
        return res.status(500).send('Failed to destroy session');
      }

      res.clearCookie('userSessionId');
      res.redirect('/');
    });
  });
};


export const logoutPage = (req,res)=>{
  try{
    res.render("user-views/userLogout")
  }catch(err){
    console.log(err)
    return res.status(500).send("Internel Server Error")
  }
}

export const googleAuthentication = passport.authenticate("google",{scope:["profile","email"]})

export const googleRedirect = passport.authenticate("google",{
    failureRedirect:"/users/login",
    successRedirect:"/",
    failureFlash: true,
})

export const userDashboard = (req,res)=>{
    res.render("user-views/dashboard.ejs")
}

export const landingPageView = async (req, res) => {
  try {
    const perfumesToLink = await Product.aggregate([
      {
        $lookup: {
          from: "categories",
          localField: "categoryId",
          foreignField: "_id",
          as: "category"
        }
      },
      { $unwind: "$category" },
      {
        $match: {
          blocked: false,
          "category.blocked": false
        }
      },
      { $limit: 8 },
      {
        $project: {
          name: 1,
          firstVariant: { $arrayElemAt: ['$variants', 0] },
          categoryId: 1
        }
      },
      {
        $project: {
          name: 1,
          image: { $arrayElemAt: ['$firstVariant.images', 0] },
          price: '$firstVariant.price',
          volume: '$firstVariant.volume',
          categoryId:1
        }
      }
    ]);
    // console.log(perfumes);
    const perfumes = await productActiveOfferLinker(perfumesToLink);
    // console.log(perfumes);
    res.render("user-views/landingPage", { perfumes,currentUser: req.user || null });
  } catch (error) {
    console.error('Error loading landing page perfumes:', error);
    res.status(500).render("error", { message: "Something went wrong while loading the landing page." });
  }
};

export const signupPage = (req,res)=>{
    res.render("user-views/userSignupPage.ejs")
}

export const signup = async (req,res)=>{
    const {fullname,email,password}= req.body;
    let code = req.body.code;
    console.log(code);
    const existing = await User.findOne({email})
    if(existing && existing.isVerified){
        return res.render("user-views/login.ejs",
          {
            errorMessage:"User Allready Exist"
          }
        )
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(otp);
    const otpExpires = Date.now() + 60 * 1000; // 1 minute

    const hashedPassword = await bcrypt.hash(password,10);

    let referralUser = null;
    if(code){
      code = code.toUpperCase();
      referralUser = await User.findOne({
        referralCode:code
      })
    }
    const user = existing || new User({email});
    
    user.name= fullname;
    user.password= hashedPassword;
    user.authType = "local";
    user.otp = otp;
    user.otpExpires = otpExpires;
    user.isVerified = false;
    user.referredBy = referralUser ? referralUser._id: null;

    await user.save();
    await sendOtpEmail(email,otp);
    console.log("send")
    res.render("user-views/otpResend.ejs",{email});

}

export const verifyOtp = async (req, res) => {
  const { otp, email } = req.body;
  const user = await User.findOne({ email });

  if (!user || user.isVerified) {
    return res.render("user-views/userVerified.ejs", {
      success: false,
      message: "Invalid request."
    });
  }

  if (user.otpExpires < Date.now()) {
    return res.render("user-views/userVerified.ejs", {
      success: false,
      message: "OTP has expired. Please request a new one."
    });
  }

  if (otp !== user.otp) {
    return res.render("user-views/userVerified.ejs", {
      success: false,
      message: "Invalid OTP. Please try again."
    });
  }
  let referralCode = generateReferralCode();
  let isExistingReferral = await User.findOne({referralCode});
  while(isExistingReferral){
    referralCode = generateReferralCode();
    isExistingReferral = await User.findOne({referralCode});
  }
  user.isVerified = true;
  user.otp = undefined;
  user.otpExpires = undefined;
  user.referralCode = referralCode;
  await user.save();

  if(user.referredBy){
    const referredByUser = await User.findById(user.referredBy);
    let referredByUserWallet = await Wallet.findOne({userId:user.referredBy});
    if(!referredByUserWallet && referredByUser){
      referredByUserWallet = new Wallet({userId:referredByUser._id,balance: 0})
    };

    referredByUserWallet.balance += 100;

    referredByUserWallet.transactions.push({
      type:"Credit",
      amount:100,
      description:`Credited for referring User ${user.name}`,
    });
    await referredByUserWallet.save();

    let userWallet = await Wallet.findById(user.id);

    if(!userWallet){
      userWallet = new Wallet({userId:user._id,balance: 0})
    };

    userWallet.balance += 100;
    userWallet.transactions.push({
      type:"Credit",
      amount:100,
      description:`Credited for Using Referral Code from ${referredByUser.name}`,
    });
    await userWallet.save();
  }

  res.render("user-views/userVerified.ejs", {
    success: true,
    message: "Your account has been verified and registered successfully."
  });
};

export const resentOtp = async (req,res)=>{
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user || user.isVerified) return res.status(400).send("Invalid request");
  
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = Date.now() + 60 * 1000;

    console.log(otp)
  
    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();
    await sendOtpEmail(email, otp);
  
    res.render("user-views/otpResend.ejs",{email});
}


export const forgotPasswordGet = (req,res)=>{
  res.render("user-views/forgotPassword",{error:null,email:""})

}

export const forgotPasswordPost = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.render("user-views/forgotPassword", { error: "User not found", email: "" });
    }

    if (!user.isVerified) {
      return res.render("user-views/forgotPassword", { error: "Email is not verified", email });
    }

    if (user.authType !== "local") {
      return res.render("user-views/forgotPassword", { error: "Cannot reset password for this login method", email });
    }

    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

 
    user.resetOtp = otp;
    user.resetOtpExpires = Date.now() + 60 * 1000;
    await user.save();

   
    await sendOtpPassword(email, otp);

    console.log(`${otp}`)
    return res.render("user-views/resetOtp", { email, error: null, success: "OTP sent to your email." });

  } catch (error) {
    console.error("Error in forgotPasswordPost:", error);
    return res.status(500).render("user-views/forgotPassword", { error: "Something went wrong", email: "" });
  }
};


export const verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });

    if (!user || !user.resetOtp || !user.resetOtpExpires) {
      return res.render("user-views/resetOtp", {
        email,
        error: "Invalid request. Please try again.",
        success: null
      });
    }

    if (user.resetOtp !== otp) {
      return res.render("user-views/resetOtp", {
        email,
        error: "Incorrect OTP. Please try again.",
        success: null
      });
    }

    if (user.resetOtpExpires < new Date()) {
      return res.render("user-views/resetOtp", {
        email,
        error: "OTP expired. Please resend.",
        success: null
      });
    }

    return res.render("user-views/resetPassword", {
      email
    });

  } catch (error) {
    console.error("Error in verifyResetOtp:", error);
    res.status(500).send("Internal Server Error");
  }
};



export const updatePassword = async (req, res) => {
  try {
    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])[a-zA-Z\d\W_]{8,}$/;
    const { email, newPassword, confirmPassword } = req.body;

   
    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ error: "All fields are required." });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match." });
    }

    if(!passwordPattern.test(newPassword)){
      return res.status(400).json({ error: "Password must be at least 8 characters long, include uppercase, lowercase, number, and special character." });
    }
   
    const user = await User.findOne({ email });

    if (!user || !user.resetOtp || !user.resetOtpExpires) {
      return res.status(400).json({ error: "Invalid or expired OTP process. Please try again." });
    }



    const hashedPassword = await bcrypt.hash(newPassword, 10);


    user.password = hashedPassword;
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;

    await user.save();


    return res.status(200).json({ message: "Password updated successfully. You can now log in." });

  } catch (error) {
    console.error("Error in updatePassword:", error);
    return res.status(500).json({ error: "Something went wrong. Please try again later." });
  }
};

export const resendResetOtp = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.render("user-views/forgotPassword", {
        error: "User not found",
        email: ""
      });
    }

    if (!user.isVerified) {
      return res.render("user-views/forgotPassword", {
        error: "Email is not verified",
        email
      });
    }

    if (user.authType !== "local") {
      return res.render("user-views/forgotPassword", {
        error: "Cannot reset password for this login method",
        email
      });
    }


    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();


    user.resetOtp = newOtp;
    user.resetOtpExpires = Date.now() + 60 * 1000; 
    await user.save();


    await sendOtpPassword(email, newOtp);

    console.log("Resent OTP:", newOtp);


    return res.render("user-views/resetOtp", {
      email,
      error: null,
      success: "A new OTP has been sent to your email."
    });

  } catch (error) {
    console.error("Error in resendResetOtp:", error);
    return res.status(500).render("user-views/forgotPassword", {
      error: "Something went wrong. Please try again.",
      email: ""
    });
  }
};