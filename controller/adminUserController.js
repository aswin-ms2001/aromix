import express from "express";
import Admin from "../model/admin.js";
import User from "../model/user.js";
import { HTTP_STATUS } from "../utils/httpStatus.js";
// import upload from "../middleware/uploads/multer.js";
// import cloudinary from '../config/cloudinary.js'; 
// import Product from "../model/product.js"

export const showUsers = async (req, res) => {
  try {
    const perPage = 4;
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || "";

    const query = { isVerified: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }

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
      search
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send("Server Error");
  }
};


export const block = async (req, res) => {
  try {
    const userId = req.params.id;
    const { blocked } = req.body;

    await User.findByIdAndUpdate(userId, { blocked });

    res.status(HTTP_STATUS.OK).json({ message: "User status updated" });
  } catch (err) {
    console.error("Error updating user block status:", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
  }
};