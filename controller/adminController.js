import express from "express";
import Admin from "../model/admin.js";
import Category from "../model/category.js";
import upload from "../middleware/uploads/multer.js";
import cloudinary from '../config/cloudinary.js'; 
import Product from "../model/product.js";
import Order from "../model/oder.js";
import { HTTP_STATUS } from "../utils/httpStatus.js";
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
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send("Internal Server Error")
    }

}

export const dashboard = async (req,res)=>{
    try {
        const { 
            period = 'yearly',
            customDate,
            customMonth,
            customYear,
            customWeekStart
        } = req.query;
        
        // Calculate date range based on period
        let startDate, endDate;
        const now = new Date();
        
        switch(period) {
            case 'daily':
                if (customDate) {
                    startDate = new Date(customDate);
                    startDate.setHours(0, 0, 0, 0);
                    endDate = new Date(customDate);
                    endDate.setHours(23, 59, 59, 999);
                } else {
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
                }
                break;
            case 'weekly':
                if (customWeekStart) {
                    startDate = new Date(customWeekStart);
                    startDate.setHours(0, 0, 0, 0);
                    endDate = new Date(startDate);
                    endDate.setDate(startDate.getDate() + 7);
                } else {
                    const day = now.getDay();
                    const diffToMonday = (day + 6) % 7;
                    startDate = new Date(now);
                    startDate.setDate(now.getDate() - diffToMonday);
                    startDate.setHours(0, 0, 0, 0);
                    endDate = new Date(startDate);
                    endDate.setDate(startDate.getDate() + 7);
                }
                break;
            case 'monthly':
                if (customMonth && customYear) {
                    startDate = new Date(customYear, customMonth - 1, 1);
                    endDate = new Date(customYear, customMonth, 1);
                } else {
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                }
                break;
            case 'yearly':
            default:
                if (customYear) {
                    startDate = new Date(customYear, 0, 1);
                    endDate = new Date(parseInt(customYear) + 1, 0, 1);
                } else {
                    startDate = new Date(now.getFullYear(), 0, 1);
                    endDate = new Date(now.getFullYear() + 1, 0, 1);
                }
                break;
        }

        // Get orders within date range
        const orders = await Order.find({
            createdAt: { $gte: startDate, $lt: endDate },
            orderStatus: { $in: [ "Delivered"] }
        }).populate('items.productId').lean();

        // Calculate metrics
        const totalRevenue = orders.reduce((sum, order) => sum + (order.grandTotal || 0), 0);
        const totalOrders = orders.length;
        const totalProductsSold = orders.reduce((sum, order) => 
            sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
        );

        // Get unique customers
        const uniqueCustomers = new Set(orders.map(order => order.userId.toString())).size;

        // Best selling products (top 10)
        const productSales = {};
        orders.forEach(order => {
            order.items.forEach(item => {
                const productId = item.productId._id.toString();
                const productName = item.productId.name;
                if (!productSales[productId]) {
                    productSales[productId] = {
                        name: productName,
                        quantity: 0,
                        revenue: 0
                    };
                }
                productSales[productId].quantity += item.quantity;
                productSales[productId].revenue += item.total;
            });
        });

        const bestSellingProducts = Object.values(productSales)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);

        // Best selling categories (top 10)
        const categorySales = {};
        orders.forEach(order => {
            order.items.forEach(item => {
                const categoryName = item.productId.categoryName;
                if (!categorySales[categoryName]) {
                    categorySales[categoryName] = {
                        name: categoryName,
                        quantity: 0,
                        revenue: 0
                    };
                }
                categorySales[categoryName].quantity += item.quantity;
                categorySales[categoryName].revenue += item.total;
            });
        });

        const bestSellingCategories = Object.values(categorySales)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);

        // Chart data for orders over time based on period
        const chartData = {};
        let chartLabels = [];
        let chartOrdersData = [];
        let chartRevenueData = [];

        if (period === 'daily') {
            // Hourly data for daily view
            for (let hour = 0; hour < 24; hour += 2) {
                const hourLabel = `${hour.toString().padStart(2, '0')}:00 - ${(hour + 2).toString().padStart(2, '0')}:00`;
                chartLabels.push(hourLabel);
                chartData[hour] = { orders: 0, revenue: 0 };
            }
            
            orders.forEach(order => {
                const hour = new Date(order.createdAt).getHours();
                const hourGroup = Math.floor(hour / 2) * 2;
                chartData[hourGroup].orders += 1;
                chartData[hourGroup].revenue += order.grandTotal;
            });
            
            chartOrdersData = chartLabels.map((_, index) => chartData[index * 2].orders);
            chartRevenueData = chartLabels.map((_, index) => chartData[index * 2].revenue);
            
        } else if (period === 'weekly') {
            // Daily data for weekly view (Sunday to Saturday)
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            days.forEach((day, index) => {
                chartLabels.push(day);
                chartData[index] = { orders: 0, revenue: 0 };
            });
            
            orders.forEach(order => {
                const dayOfWeek = new Date(order.createdAt).getDay();
                chartData[dayOfWeek].orders += 1;
                chartData[dayOfWeek].revenue += order.grandTotal;
            });
            
            chartOrdersData = days.map((_, index) => chartData[index].orders);
            chartRevenueData = days.map((_, index) => chartData[index].revenue);
            
        } else if (period === 'monthly') {
            // Daily data for monthly view
            const daysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
            for (let day = 1; day <= daysInMonth; day++) {
                chartLabels.push(day.toString());
                chartData[day] = { orders: 0, revenue: 0 };
            }
            
            orders.forEach(order => {
                const day = new Date(order.createdAt).getDate();
                chartData[day].orders += 1;
                chartData[day].revenue += order.grandTotal;
            });
            
            chartOrdersData = chartLabels.map(day => chartData[parseInt(day)].orders);
            chartRevenueData = chartLabels.map(day => chartData[parseInt(day)].revenue);
            
        } else if (period === 'yearly') {
            // Monthly data for yearly view
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            months.forEach((month, index) => {
                chartLabels.push(month);
                chartData[index] = { orders: 0, revenue: 0 };
            });
            
            orders.forEach(order => {
                const month = new Date(order.createdAt).getMonth();
                chartData[month].orders += 1;
                chartData[month].revenue += order.grandTotal;
            });
            
            chartOrdersData = months.map((_, index) => chartData[index].orders);
            chartRevenueData = months.map((_, index) => chartData[index].revenue);
        }

        
        res.render("admin-views/adminDashboard", {
            period,
            customDate,
            customMonth,
            customYear,
            customWeekStart,
            metrics: {
                revenue: totalRevenue,
                orders: totalOrders,
                productsSold: totalProductsSold,
                customers: uniqueCustomers
            },
            bestSellingProducts,
            bestSellingCategories,
            chartData: {
                labels: chartLabels,
                orders: chartOrdersData,
                revenue: chartRevenueData
            }
        });
    } catch (err) {
        console.error("Dashboard error:", err);
        res.render("admin-views/adminDashboard", {
            period: 'yearly',
            metrics: { revenue: 0, orders: 0, productsSold: 0, customers: 0 },
            bestSellingProducts: [],
            bestSellingCategories: [],
            chartData: { labels: [], orders: [], revenue: [] }
        });
    }
}

export const addProduct = async (req,res)=>{
    try{
        const categories = await Category.find();
        res.render("admin-views/adminProductAddingpage.ejs",{categories});
    }catch(err){
        console.log(err);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send("internal server error");
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
        return res.status(HTTP_STATUS.BAD_REQUEST).send("No file uploaded.");
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
    res.status(HTTP_STATUS.OK).json({ message: 'Category status updated' });
  } catch (err) {
    console.error(err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Error updating category' });
  }
};

export const editProduct = async (req,res)=>{
  try {
    const productId = req.params.id;


    const product = await Product.findById(productId).lean();
    if (!product) {
      return res.status(HTTP_STATUS.NOT_FOUND).send("Product not found");
    }


    const categories = await Category.find({ blocked: false }).lean();

    res.render('admin-views/editProduct', {
      product,
      categories
    });
  } catch (err) {
    console.error("Error in editProduct controller:", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send("Server error");
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
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: 'Category name is required' });
    }


    const duplicate = await Category.find({
      name: new RegExp(`^${categoryName.trim()}$`,'i')
    })

    console.log(duplicate);
    if(duplicate[0]){
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'Category Name Already exist' });
    }
    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      { name: categoryName.trim() },
      { new: true }
    );

    if (!updatedCategory) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ message: 'Category not found' });
    }

    res.json({ message: 'Category updated successfully', category: updatedCategory });
  } catch (error) {
    console.error(error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: 'Server error' });
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
          return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Product price cannot be zero or less" });
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

      res.status(HTTP_STATUS.OK).json({ message: "Product updated successfully" });
    } catch (err) {
      console.error("Error updating product:", err);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ message: "Internal server error" });
    }
  },
];


export const addNewVariants = [
  // Accept any file field 
  upload.any(),

  async (req, res) => {
    try {
      const productId = req.params.productId;



      // Validate product exists
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(HTTP_STATUS.NOT_FOUND).json({
          success: false,
          message: "Product not found",
        });
      }

      // Ensure we actually have variants in body
      if (!Array.isArray(req.body.newVariants) || req.body.newVariants.length === 0) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          message: "No variants provided",
        });
      }

      const variantsToAdd = [];
      const descriptionPattern = /^[a-zA-Z]\w{5,}/;

      for (let i = 0; i < req.body.newVariants.length; i++) {
        const variant = req.body.newVariants[i];

        const volume = parseFloat(variant.volume);
        const price = parseFloat(variant.price);
        const stock = parseInt(variant.stock);
        const description = variant.description;

        // ===== VALIDATIONS =====
        if (!volume || volume <= 0) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: `Variant ${i + 1}: Volume must be a positive number`,
          });
        }
        if (!price || price <= 0) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: `Variant ${i + 1}: Price must be a positive number`,
          });
        }
        if (stock < 0) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: `Variant ${i + 1}: Stock must be a non-negative number`,
          });
        }
        if (!description || !description.trim()) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: `Variant ${i + 1}: Description is required`,
          });
        }
        if (!descriptionPattern.test(description.trim())) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: `Variant ${i + 1}: Description must start with a letter followed by at least 5 characters`,
          });
        }

        // ===== IMAGES HANDLING =====
        const filesForVariant = (req.files || []).filter(
          (file) => file.fieldname === `newVariants[${i}][images]`
        );

        if (filesForVariant.length < 4) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message: `Variant ${i + 1}: All 4 images are required`,
          });
        }

        // Upload images to Cloudinary
        const uploadedImages = await Promise.all(
          filesForVariant.map((file) =>
            cloudinary.uploader
              .upload(file.path, {
                folder: "products/variants",
                crop: "fill",
                width: 500,
                height: 500,
                gravity: "auto",
              })
              .then((result) => result.secure_url)
          )
        );

        // Add validated variant
        variantsToAdd.push({
          volume,
          price,
          stock,
          description: description.trim(),
          images: uploadedImages,
        });
      }

      // ===== SAVE TO DATABASE =====
      product.variants.push(...variantsToAdd);
      await product.save();

      res.json({
        success: true,
        message: `${variantsToAdd.length} new variant(s) added successfully`,
        product,
      });
    } catch (err) {
      console.error("Error adding new variants:", err);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
];
