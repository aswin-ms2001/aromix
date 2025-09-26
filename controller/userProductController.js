import express from "express";
import User from "../model/user.js";
import Product from "../model/product.js";
import Category from "../model/category.js"
import mongoose from "mongoose";
import { getRelatedProducts } from "./services/userServices/relatedProductServices.js";
import { getWishlistVariantIds } from "./services/userServices/wishlistServices.js";
import { productActiveOfferLinker,productOfferFinder } from "./services/userServices/userOfferService.js";
// import { productDetails } from "./adminController.js";

export const discoverPage = async (req, res) => {
  try {
    const id = req.user._id;
    if(!id) return res.status(500).render("error");
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
    console.log(variantSortDirection);
    console.log(isPriceSort);
    console.log(matchStage);
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
        $lookup: {
          from: "offers",
          let: { productId: "$_id", categoryId: "$categoryId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$isActive", true] },
                    { $eq: ["$isNonBlocked", true] },
                    { $lte: ["$startAt", new Date()] },   // started
                    { $gte: ["$endAt", new Date()] },     // not expired
                    {
                      $or: [
                        { $eq: ["$productId", "$$productId"] },
                        { $eq: ["$categoryId", "$$categoryId"] }
                      ]
                    }
                  ]
                }
              }
            },
            { $sort: { discountPercent: -1 } }, // highest first
            { $limit: 1 } // keep only biggest
          ],
          as: "offer"
        }
      },
      {
        $addFields: {
          offer: { $arrayElemAt: ["$offer.discountPercent", 0] } // extract first object
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
                  {
                    $gte: [
                      {
                        $cond: [
                          { $ifNull: ["$offer", false] }, // if offer exists
                          {
                            $multiply: [
                              "$$variant.price",
                              { $divide: [ { $subtract: [100, "$offer"] }, 100 ] }
                            ]
                          },
                          "$$variant.price"
                        ]
                      },
                      minPrice
                    ]
                  },
                  {
                    $lte: [
                      {
                        $cond: [
                          { $ifNull: ["$offer", false] }, // if offer exists
                          {
                            $multiply: [
                              "$$variant.price",
                              { $divide: [ { $subtract: [100, "$offer"] }, 100 ] }
                            ]
                          },
                          "$$variant.price"
                        ]
                      },
                      maxPrice
                    ]
                  }
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
        $addFields: {
          finalPrice: {
            $cond: [
              { $ifNull: ["$offer", false] }, // if offer exists
              {
                $multiply: [
                  "$selectedVariant.price",
                  { $divide: [ { $subtract: [100, "$offer"] }, 100 ] }
                ]
              },
              "$selectedVariant.price"
            ]
          }
        }
      },
      {
        $project: {
          name: 1,
          image: { $arrayElemAt: ["$selectedVariant.images", 0] },
          price: "$selectedVariant.price",
          finalPrice:1,
          volume: "$selectedVariant.volume",
          offer:1,
          createdAt: 1,
          categoryId:1
        }
      },
      {
        $sort: (() => {
          if (sort === "asc") return { name: 1 };
          if (sort === "desc") return { name: -1 };
          if (sort === "lowToHigh") return { finalPrice: 1 };
          if (sort === "highToLow") return { finalPrice: -1 };
          return { createdAt: -1 };
        })()
      },
      { $skip: skip },
      { $limit: limit }
    ]);

    console.log(products)
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
        $lookup: {
          from: "offers",
          let: { productId: "$_id", categoryId: "$categoryId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$isActive", true] },
                    { $eq: ["$isNonBlocked", true] },
                    { $lte: ["$startAt", new Date()] },
                    { $gte: ["$endAt", new Date()] },
                    {
                      $or: [
                        { $eq: ["$productId", "$$productId"] },
                        { $eq: ["$categoryId", "$$categoryId"] }
                      ]
                    }
                  ]
                }
              }
            },
            { $sort: { discountPercent: -1 } },
            { $limit: 1 }
          ],
          as: "offer"
        }
      },
      {
        $addFields: {
          offer: { $arrayElemAt: ["$offer.discountPercent", 0] }
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
                  {
                    $gte: [
                      {
                        $cond: [
                          { $ifNull: ["$offer", false] },
                          {
                            $multiply: [
                              "$$variant.price",
                              { $divide: [ { $subtract: [100, "$offer"] }, 100 ] }
                            ]
                          },
                          "$$variant.price"
                        ]
                      },
                      minPrice
                    ]
                  },
                  {
                    $lte: [
                      {
                        $cond: [
                          { $ifNull: ["$offer", false] },
                          {
                            $multiply: [
                              "$$variant.price",
                              { $divide: [ { $subtract: [100, "$offer"] }, 100 ] }
                            ]
                          },
                          "$$variant.price"
                        ]
                      },
                      maxPrice
                    ]
                  }
                ]
              }
            }
          }
        }
      },
      { $match: { filteredVariants: { $ne: [] } } },
      { $count: "total" }
    ]);

    // const products = await productActiveOfferLinker(productsToLink)
    console.log(products)
    const user = await User.findById(id);
    const totalProducts = totalCountAgg[0]?.total || 0;
    const totalPages = Math.ceil(totalProducts / limit);

    const categories = await Category.find({ blocked: false });
    // console.log(products)
    res.render("user-views/discover.ejs", {
      user,
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
    const userId = req.user._id;
    const productId = req.params.id;
    const variantId = req.query.variantId || null;
    // console.log(variantId)
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
      },
      {
        $project:{
          name:1,
          categoryId:1,
          categoryName:1,
          gender:1,
          variants:1,
        }
      }
    ]);

  
    const product = productAggregation[0];

    if (!product) {
      return res.status(404).render("error", { message: "Product not found or has been blocked" });
    } 
    const categoryId = product.categoryId;
    const relatedProductsToLink = await getRelatedProducts(product);
    const wishlistVariantIds = await getWishlistVariantIds(userId,productId);
    const productOffer =await productOfferFinder(productId,categoryId);
    product.offer = productOffer;
    // console.log(product);
    const relatedProducts = await productActiveOfferLinker(relatedProductsToLink);
    // console.log(relatedProducts);
    res.render("user-views/productDetails", {
      product,
      relatedProducts,
      wishlistVariantIds,
      variantId
    });

  } catch (error) {
    console.error("Error loading product details:", error);
    res.status(500).render("error", { message: "Internal Server Error" });
  }
};