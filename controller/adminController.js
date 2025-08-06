import express from "express";
import Admin from "../model/admin.js";
import Category from "../model/category.js";
import upload from "../middleware/uploads/multer.js";
import cloudinary from '../config/cloudinary.js'; 
import Product from "../model/product.js"

import fs from 'fs'; 

export const loginPage = (req,res)=>{
    const errorMessage = req.flash("error");
    res.render("admin-views/adminLogin",{
      errorMessage:errorMessage[0]
    })
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
            console.log("invalid details");
            req.flash("error","Invalid Credentils")
            res.redirect("/admin/login")
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


export const logout = (req, res) => {
  res.render('admin-views/logoutConfirm');
}

export const logoutConfirm =  (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error("Logout error:", err);
      return res.redirect('/admin/dashboard');
    }
    res.clearCookie('adminSessionId'); 
    res.redirect('/admin/login');
  });
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


export const productDetails = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    const search = req.query.search || "";

    const searchFilter = search
      ? { name: { $regex: search, $options: "i" } }
      : {};


    const totalProducts = await Product.countDocuments(searchFilter);
    const totalPages = Math.ceil(totalProducts / limit);


    const products = await Product.find(searchFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.render("admin-views/adminProductFirst.ejs", {
      products,
      currentPage: page,
      totalPages,
      search, 
    });
  } catch (err) {
    console.error("Error fetching products:", err);
    res.render("error.ejs");
  }
};

export const addProductPost = [
  upload.fields([
    { name: "variantImages", maxCount: 100 }, 
  ]),
  async (req, res) => {
    try {
      const { name, gender } = req.body;
      const [categoryId, categoryName] = req.body.category.split("::");
      let variantsData = req.body.variants;

     
      if (typeof variantsData === "string") {
        variantsData = JSON.parse(variantsData);
      }

      

      if (!Array.isArray(variantsData)) {
        variantsData = [variantsData];
      }

      const variantImageFiles = req.files["variantImages"] || [];
      const variants = [];
      let fileIndex = 0;

      for (const variant of variantsData) {
        const images = [];

        for (let j = 0; j < 4; j++) {
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
           
          }
          fileIndex++;
        }

        variants.push({
          volume: variant.volume,
          price: variant.price,
          stock: variant.stock,
          description: variant.description,
          images,
        });
      }

      
      const newProduct = new Product({
        name,
        gender,
        categoryId:categoryId,
        categoryName:categoryName,
        variants,
      });

      await newProduct.save();

      await Category.findByIdAndUpdate(categoryId, {
        $push: { products: newProduct._id }
      });

      res.redirect("/products/showProducts");
    } catch (err) {
      console.error("Error adding product:", err);
      res.render("error.ejs");
    }
  },
];

// export const categoryFront = (req,res)=>{
//   res.render("admin-views/categoryFront.ejs")
// }

export const categoryFront = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;
    const searchQuery = req.query.search || "";

    const filter = searchQuery
      ? { name: { $regex: searchQuery, $options: "i" } }
      : {};

    const [categories, totalCount] = await Promise.all([
      Category.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Category.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.render("admin-views/categoryFront.ejs", {
      categories,
      currentPage: page,
      totalPages,
      searchQuery
    });
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.render("error.ejs");;
  }
};


export const addCategory = (req,res)=>{
  res.render("admin-views/categoryAdding.ejs")
}

export const addCategoryPost = async (req, res) => {
  try {
    const { categoryName } = req.body;

    if (!categoryName || !categoryName.trim()) {
      return res.render("admin-views/categoryAdding.ejs", {
        message: "Category name is required.",
        success: false
      });
    }

    const existing = await Category.findOne({
      name: { $regex: `^${categoryName.trim()}$`, $options: 'i' }
    });
    if (existing) {
      return res.render("admin-views/categoryAdding.ejs", {
        message: "Category already exists.",
        success: false
      });
    }

    const newCategory = new Category({ name: categoryName.trim() });
    await newCategory.save();

    res.render("admin-views/categoryAdding.ejs", {
      message: "Category created successfully!",
      success: true
    });
  } catch (err) {
    console.error("Error creating category:", err);
    res.render("admin-views/categoryAdding.ejs", {
      message: "Something went wrong. Please try again.",
      success: false
    });
  }
};

export const blockProduct = async (req, res) => {
  try {
    const { blocked } = req.body;
    await Product.findByIdAndUpdate(req.params.id, { blocked });
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
}

export const blockCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { blocked } = req.body;

    await Category.findByIdAndUpdate(id, { blocked });
    res.status(200).json({ message: 'Category status updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating category' });
  }
};

export const editProduct = async (req,res)=>{
  try {
    const productId = req.params.id;


    const product = await Product.findById(productId).lean();
    if (!product) {
      return res.status(404).send("Product not found");
    }


    const categories = await Category.find({ blocked: false }).lean();

    res.render('admin-views/editProduct', {
      product,
      categories
    });
  } catch (err) {
    console.error("Error in editProduct controller:", err);
    res.status(500).send("Server error");
  }
}


export const getEditCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).lean();
    if (!category) return res.redirect('/adminCategory/category');

    res.render("admin-views/editCategory.ejs", {
      category
    });
  } catch (err) {
    console.error("Error loading edit category:", err);
    res.redirect('/adminCategory/category-front');
  }
};

export const getEditCategoryPost =  async (req, res) => {
  try {
    const { categoryName } = req.body;
    const categoryId = req.params.id;

    if (!categoryName || !categoryName.trim()) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      { name: categoryName.trim() },
      { new: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({ message: 'Category updated successfully', category: updatedCategory });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
}


export const editProductPost = [
  upload.fields([{ name: "variantImages", maxCount: 100 }]),

  async (req, res) => {
    try {
      const productId = req.params.id;
      const { name, gender } = req.body;
      const [newCategoryId, newCategoryName] = req.body.category.split("::");

      const uploadedFiles = req.files["variantImages"] || [];
      let uploadIndex = 0;

      function toArray(val) {
        if (Array.isArray(val)) return val;
        if (val) return [val];
        return [];
      }

      function getPublicIdFromUrl(url) {
        const parts = url.split("/");
        const fileWithExt = parts.pop();
        const fileName = fileWithExt.split(".")[0];
        const folder = parts.slice(parts.indexOf("upload") + 1).join("/");
        return `${folder}/${fileName}`;
      }

      // Fetch existing product
      const existingProduct = await Product.findById(productId);
      const oldCategoryId = existingProduct.categoryId.toString();
      const updatedVariants = [];

      let i = 0;
      while (req.body[`variants[${i}].volume`] !== undefined) {
        const variantId = req.body[`variants[${i}]._id`] || null;
        const existingVariant = variantId
          ? existingProduct.variants.id(variantId)
          : null;

        const existingImages = toArray(req.body[`variants[${i}].existingImages[]`]);
        const images = [];

        for (let j = 0; j < 4; j++) {
          const existing = existingImages[j];
          const cropped = req.body[`variants[${i}].croppedImages[${j}]`] || "";
          const file = uploadedFiles[uploadIndex];

          let imageUrl = null;

          if (cropped && cropped.trim().startsWith("data:image")) {
            if (existing) {
              try {
                const publicId = getPublicIdFromUrl(existing);
                await cloudinary.uploader.destroy(publicId);
              } catch (err) {
                console.warn("Failed to delete old image:", existing);
              }
            }
            const result = await cloudinary.uploader.upload(cropped, {
              folder: "products/variants",
            });
            imageUrl = result.secure_url;
          } else if (file) {
            if (existing) {
              try {
                const publicId = getPublicIdFromUrl(existing);
                await cloudinary.uploader.destroy(publicId);
              } catch (err) {
                console.warn("Failed to delete old image:", existing);
              }
            }
            const result = await cloudinary.uploader.upload(file.path, {
              folder: "products/variants",
              crop: "fill",
              width: 500,
              height: 500,
              gravity: "auto",
            });
            imageUrl = result.secure_url;
            uploadIndex++;
          } else if (existing) {
            imageUrl = existing;
          }

          images.push(imageUrl || null);
        }

        if (req.body[`variants[${i}].price`] <= 0) {
          return res.status(400).json({ message: "Product price cannot be zero or less" });
        }

        if (existingVariant) {
          //  Update existing variant (retain _id)
          existingVariant.volume = req.body[`variants[${i}].volume`];
          existingVariant.price = req.body[`variants[${i}].price`];
          existingVariant.stock = req.body[`variants[${i}].stock`];
          existingVariant.description = req.body[`variants[${i}].description`];
          existingVariant.images = images;
          updatedVariants.push(existingVariant);
        } else {
          //  Add new variant
          updatedVariants.push({
            volume: req.body[`variants[${i}].volume`],
            price: req.body[`variants[${i}].price`],
            stock: req.body[`variants[${i}].stock`],
            description: req.body[`variants[${i}].description`],
            images,
          });
        }

        i++;
      }

      //  Save changes
      existingProduct.name = name;
      existingProduct.gender = gender;
      existingProduct.categoryId = newCategoryId;
      existingProduct.categoryName = newCategoryName;
      existingProduct.variants = updatedVariants;

      await existingProduct.save();

      //  Update category references if category changed
      if (oldCategoryId !== newCategoryId) {
        await Category.findByIdAndUpdate(oldCategoryId, {
          $pull: { products: productId },
        });

        await Category.findByIdAndUpdate(newCategoryId, {
          $addToSet: { products: productId },
        });
      }

      res.status(200).json({ message: "Product updated successfully" });
    } catch (err) {
      console.error("Error updating product:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
];
