import express from "express";
import Admin from "../model/admin.js";
import User from "../model/user.js";
// import upload from "../middleware/uploads/multer.js";
// import cloudinary from '../config/cloudinary.js'; 
// import Product from "../model/product.js"

export const showUsers = async (req, res) => {
  try {
    const perPage = 4;
    const page = parseInt(req.query.page) || 1;

    const query = { isVerified: true };

    const users = await User.find(query)
      .skip((page - 1) * perPage)
      .limit(perPage)
      .lean();

    const totalUsers = await User.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / perPage);

    res.render("admin-views/usersFront", {
      users,
      currentPage: page,
      totalPages,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send("Server Error");
  }
};

export const block = async (req, res) => {
  try {
    const userId = req.params.id;
    const { blocked } = req.body;

    await User.findByIdAndUpdate(userId, { blocked });

    res.status(200).json({ message: "User status updated" });
  } catch (err) {
    console.error("Error updating user block status:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};