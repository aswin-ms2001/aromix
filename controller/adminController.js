import express from "express";
import Admin from "../model/admin.js";
import Category from "../model/category.js";
import upload from "../middleware/uploads/multer.js";
import cloudinary from '../config/cloudinary.js'; 
import Product from "../model/product.js"

import fs from 'fs'; 

export const loginPage = (req,res)=>{
    res.render("admin-views/adminLogin")
}

export const login = async (req,res)=>{
    const {email,password} = req.body;
    try{
        const details = await Admin.find();
        const [adminDetails] = details;
        console.log(adminDetails)
        if(adminDetails.email === req.body.email && adminDetails.password === req.body.password){
            req.session.admin = {
                id:adminDetails._id,
                email:adminDetails.email
            }
            res.redirect("/admin/dashboard");
        }
        else{
            console.log("invalid details")
            res.render("admin-views/adminLogin");
        }

    }catch(err){
        console.log(err);
        res.status(500).send("Internal Server Error")
    }

}

export const dashboard = (req,res)=>{
    res.render("admin-views/adminDashboard");
}

export const addProduct = async (req,res)=>{
    try{
        const categories = await Category.find();
        res.render("admin-views/adminProductAddingpage.ejs",{categories});
    }catch(err){
        console.log(err);
        res.status(500).send("internal server error");
    }

}

export const uploader = [
    upload.single('image'),
    (req, res) => {
      if (!req.file) {
        return res.status(400).send("No file uploaded.");
      }
      res.json({ imageUrl: req.file.path });
    }
  ];

export const productDetails = (req,res)=>{
    res.render("admin-views/adminProductFirst.ejs")
}


export const addProductPost = [
    upload.fields([
      { name: "productImages", maxCount: 4 },
      { name: "variantImages", maxCount: 100 },
    ]),
    async (req, res) => {
      try {
        const { name, price, stock, description, gender, category } = req.body;
        let variantsData = req.body.variants;
  
        // ✅ Parse variantsData safely
        if (typeof variantsData === "string") {
          variantsData = JSON.parse(variantsData);
        }
        if (!Array.isArray(variantsData)) {
          variantsData = [variantsData];
        }
  
        // 1. Upload Main Product Images
        const productImages = [];
        const productImageFiles = req.files["productImages"] || [];
  
        for (const file of productImageFiles) {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: "products",
            crop: "fill",
            width: 500,
            height: 500,
            gravity: "auto",
          });
          productImages.push(result.secure_url);
  
          // ❌ Remove this if multer-storage-cloudinary uploads directly (else keep)
          // unlinkSync(file.path); 
        }
  
        // 2. Upload Variant Images
        const variants = [];
        const variantImageFiles = req.files["variantImages"] || [];
        let fileIndex = 0;
  
        for (const variant of variantsData) {
          const images = [];
  
          for (let j = 0; j < 4; j++) { // 4 images per variant
            const file = variantImageFiles[fileIndex];
            if (file) {
              const result = await cloudinary.uploader.upload(file.path, {
                folder: "products/variants",
                crop: "fill",
                width: 500,
                height: 500,
                gravity: "auto",
              });
              images.push(result.secure_url);
  
              // ❌ Remove this if multer-storage-cloudinary uploads directly (else keep)
              // unlinkSync(file.path);
            }
            fileIndex++;
          }
  
          variants.push({
            volume: variant.volume,
            price: variant.price,
            images,
          });
        }
  
        // 3. Save to Database
        const newProduct = new Product({
          name,
          price,
          stock,
          description,
          gender,
          category,
          image: productImages,
          variants,
        });
  
        await newProduct.save();
        res.redirect("/admin/dashboard");
      } catch (err) {
        console.error(err);
        res.status(500).send("Error adding product");
      }
    },
  ];