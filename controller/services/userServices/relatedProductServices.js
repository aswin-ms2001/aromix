import User from "../../../model/user.js";
import Product from "../../../model/product.js";
import Category from "../../../model/category.js"
import mongoose from "mongoose";

export const getRelatedProducts = async (product) => {
  const relatedProducts = await Product.aggregate([
    {
      $match: {
        _id: { $ne: product._id },
        categoryId: product.categoryId,
        blocked: false
      }
    },
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
        "category.blocked": false
      }
    },
    { $limit: 4 },
    {
      $project: {
        name: 1,
        variants: 1,
        image: { $arrayElemAt: ["$variants.images", 0] },
        price: { $arrayElemAt: ["$variants.price", 0] },
        volume: { $arrayElemAt: ["$variants.volume", 0] },
        categoryId:1
      }
    }
  ]);
  return relatedProducts;
};