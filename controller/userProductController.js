import express from "express";
import User from "../model/user.js";
import Product from "../model/product.js";
import Category from "../model/category.js"
import mongoose from "mongoose";
// import { productDetails } from "./adminController.js";

export const discoverPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;

    const search = req.query.search || '';
    const sort = req.query.sort || '';
    const selectedCategories = Array.isArray(req.query.categories)
      ? req.query.categories
      : req.query.categories ? [req.query.categories] : [];

    const minPrice = parseFloat(req.query.minPrice) || 0;
    const maxPrice = parseFloat(req.query.maxPrice) || Number.MAX_SAFE_INTEGER;

    const matchStage = {
      blocked: false,
    };

    if (search) {
      matchStage.name = { $regex: new RegExp(search, 'i') };
    }

    if (selectedCategories.length > 0) {
      matchStage.categoryId = {
        $in: selectedCategories.map(id => new mongoose.Types.ObjectId(id))
      };
    }

    const isPriceSort = sort === 'lowToHigh' || sort === 'highToLow';
    const variantSortDirection = sort === 'lowToHigh' ? 1 : -1;

    const products = await Product.aggregate([
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
          ...matchStage,
          "category.blocked": false
        }
      },
      {
        $addFields: {
          filteredVariants: {
            $filter: {
              input: "$variants",
              as: "variant",
              cond: {
                $and: [
                  { $gte: ["$$variant.price", minPrice] },
                  { $lte: ["$$variant.price", maxPrice] }
                ]
              }
            }
          }
        }
      },
      { $match: { filteredVariants: { $ne: [] } } },
      {
        $addFields: {
          selectedVariant: {
            $arrayElemAt: [
              {
                $cond: [
                  isPriceSort,
                  {
                    $sortArray: {
                      input: "$filteredVariants",
                      sortBy: { price: variantSortDirection }
                    }
                  },
                  "$filteredVariants"
                ]
              },
              0
            ]
          }
        }
      },
      {
        $project: {
          name: 1,
          image: { $arrayElemAt: ["$selectedVariant.images", 0] },
          price: "$selectedVariant.price",
          volume: "$selectedVariant.volume",
          createdAt: 1
        }
      },
      {
        $sort: (() => {
          if (sort === "asc") return { name: 1 };
          if (sort === "desc") return { name: -1 };
          if (sort === "lowToHigh") return { price: 1 };
          if (sort === "highToLow") return { price: -1 };
          return { createdAt: -1 };
        })()
      },
      { $skip: skip },
      { $limit: limit }
    ]);

    const totalCountAgg = await Product.aggregate([
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
          ...matchStage,
          "category.blocked": false
        }
      },
      {
        $addFields: {
          filteredVariants: {
            $filter: {
              input: "$variants",
              as: "variant",
              cond: {
                $and: [
                  { $gte: ["$$variant.price", minPrice] },
                  { $lte: ["$$variant.price", maxPrice] }
                ]
              }
            }
          }
        }
      },
      { $match: { filteredVariants: { $ne: [] } } },
      { $count: "total" }
    ]);

    const totalProducts = totalCountAgg[0]?.total || 0;
    const totalPages = Math.ceil(totalProducts / limit);

    const categories = await Category.find({ blocked: false });

    res.render("user-views/discover.ejs", {
      products,
      currentPage: page,
      totalPages,
      categories,
      selectedCategories,
      sort,
      search,
      minPrice: req.query.minPrice || '',
      maxPrice: req.query.maxPrice || ''
    });

  } catch (err) {
    console.error("Error in discoverPage:", err);
    res.status(500).render("error");
  }
};

export const productDetails = async (req, res) => {
  try {
    const productId = req.params.id;

    const productAggregation = await Product.aggregate([
      {
        $match: { _id: new mongoose.Types.ObjectId(productId), blocked: false }
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
      }
    ]);

    console.log(productAggregation);
    const product = productAggregation[0];

    if (!product) {
      return res.status(404).render("error", { message: "Product not found or has been blocked" });
    }

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
          volume: { $arrayElemAt: ["$variants.volume", 0] }
        }
      }
    ]);

    res.render("user-views/productDetails", {
      product,
      relatedProducts
    });

  } catch (error) {
    console.error("Error loading product details:", error);
    res.status(500).render("error", { message: "Internal Server Error" });
  }
};