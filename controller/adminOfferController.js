import Offer from "../model/offer.js";
import Product from "../model/product.js";
import Category from "../model/category.js";

export const adminOfferFront = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;
    const search = (req.query.search || "").trim();
    const type = req.query.type || ""; // PRODUCT | CATEGORY | ''
    const status = req.query.status || ""; // active | inactive | ''

    const query = {};
    if (search) query.name = { $regex: search, $options: "i" };
    if (type) query.offerType = type;
    if (status === "active") query.isActive = true;
    if (status === "inactive") query.isActive = false;

    const totalOffers = await Offer.countDocuments(query);
    const totalPages = Math.ceil(totalOffers / limit);

    const offers = await Offer.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Attach target names
    const productIds = offers.filter(o => o.offerType === "PRODUCT" && o.productId).map(o => o.productId);
    const categoryIds = offers.filter(o => o.offerType === "CATEGORY" && o.categoryId).map(o => o.categoryId);
    const [products, categories] = await Promise.all([
      Product.find({ _id: { $in: productIds } }, { name: 1 }).lean(),
      Category.find({ _id: { $in: categoryIds } }, { name: 1 }).lean(),
    ]);
    const productMap = new Map(products.map(p => [String(p._id), p.name]));
    const categoryMap = new Map(categories.map(c => [String(c._id), c.name]));

    const normalized = offers.map(o => ({
      ...o,
      targetName: o.offerType === "PRODUCT" ? productMap.get(String(o.productId)) : categoryMap.get(String(o.categoryId))
    }));

    return res.render("admin-views/adminOffer.ejs", {
      offers: normalized,
      currentPage: page,
      totalPages,
      totalOffers,
      search,
      type,
      status,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page + 1,
      prevPage: page - 1,
    });
  } catch (err) {
    console.error("Error in adminOfferFront:", err);
    return res.render("error.ejs");
  }
};

function validateOfferPayload(body, isUpdate = false) {
  const errors = [];
  const namePattern = /^(?![ .])(?!.*[ .]{2})[A-Za-z0-9 .]{7,}$/; // min 7, no leading dot/space, no multiple consecutive dot/space

  const { name, offerType, discountPercent, startAt, endAt, productId, categoryId } = body;
  if (!name || !namePattern.test(name.trim())) errors.push("Invalid offer name");
  if (!offerType || !["PRODUCT", "CATEGORY"].includes(offerType)) errors.push("Invalid offer type");
  const percent = Number(discountPercent);
  if (!percent || percent < 1 || percent > 90) errors.push("Discount must be between 1 and 90");
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) errors.push("Invalid dates");
  if (start >= end) errors.push("Start date must be before end date");
  const now = new Date();
  if (!isUpdate && start < now) errors.push("Start date cannot be in the past");
  if (offerType === "PRODUCT" && !productId) errors.push("Product is required for product offer");
  if (offerType === "CATEGORY" && !categoryId) errors.push("Category is required for category offer");
  return { errors, start, end, percent };
}

export const createOffer = async (req, res) => {
  try {
    const { errors, start, end, percent } = validateOfferPayload(req.body, false);
    if (errors.length) return res.status(400).json({ success: false, message: errors[0] });

    // Unique name
    const existing = await Offer.findOne({ name: { $regex: `^${req.body.name.trim()}$`, $options: "i" } });
    if (existing) return res.status(400).json({ success: false, message: "Offer with this name already exists" });

    // Validate target existence
    if (req.body.offerType === "PRODUCT") {
      const product = await Product.findById(req.body.productId);
      if (!product) return res.status(400).json({ success: false, message: "Product not found" });
    } else {
      const category = await Category.findById(req.body.categoryId);
      if (!category) return res.status(400).json({ success: false, message: "Category not found" });
    }

    const offer = new Offer({
      name: req.body.name.trim(),
      offerType: req.body.offerType,
      productId: req.body.offerType === "PRODUCT" ? req.body.productId : null,
      categoryId: req.body.offerType === "CATEGORY" ? req.body.categoryId : null,
      discountPercent: percent,
      startAt: start,
      endAt: end,
      isActive: false,
    });
    await offer.save();

    res.json({ success: true, message: "Offer created" });
  } catch (err) {
    console.error("createOffer error:", err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const updateOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    const offer = await Offer.findById(offerId);
    if (!offer) return res.status(404).json({ success: false, message: "Offer not found" });

    const { errors, start, end, percent } = validateOfferPayload(req.body, true);
    if (errors.length) return res.status(400).json({ success: false, message: errors[0] });

    // Unique name check excluding self
    const existing = await Offer.findOne({
      _id: { $ne: offerId },
      name: { $regex: `^${req.body.name.trim()}$`, $options: "i" },
    });
    if (existing) return res.status(400).json({ success: false, message: "Offer name already in use" });

    // Validate target existence
    if (req.body.offerType === "PRODUCT") {
      const product = await Product.findById(req.body.productId);
      if (!product) return res.status(400).json({ success: false, message: "Product not found" });
    } else {
      const category = await Category.findById(req.body.categoryId);
      if (!category) return res.status(400).json({ success: false, message: "Category not found" });
    }

    offer.name = req.body.name.trim();
    offer.offerType = req.body.offerType;
    offer.productId = req.body.offerType === "PRODUCT" ? req.body.productId : null;
    offer.categoryId = req.body.offerType === "CATEGORY" ? req.body.categoryId : null;
    offer.discountPercent = percent;
    offer.startAt = start;
    offer.endAt = end;
    // Keep isActive as-is; cron/toggle handles it

    await offer.save();
    res.json({ success: true, message: "Offer updated" });
  } catch (err) {
    console.error("updateOffer error:", err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const toggleOfferActive = async (req, res) => {
  try {
    const offerId = req.params.id;
    const { activate } = req.body; // true|false
    const offer = await Offer.findById(offerId);
    if (!offer) return res.status(404).json({ success: false, message: "Offer not found" });

    const now = new Date();
    if (!(offer.startAt <= now && now <= offer.endAt)) {
      return res.status(400).json({ success: false, message: "Offer can only be toggled within its active window" });
    }

    offer.isActive = !!activate;
    await offer.save();

    res.json({ success: true, message: `Offer ${offer.isActive ? "activated" : "deactivated"}` });
  } catch (err) {
    console.error("toggleOfferActive error:", err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const searchTargets = async (req, res) => {
  try {
    const type = req.query.type; // PRODUCT | CATEGORY
    const q = (req.query.q || "").trim();
    if (!type || !["PRODUCT", "CATEGORY"].includes(type)) {
      return res.status(400).json({ success: false, message: "Invalid type" });
    }
    if (!q) return res.json({ success: true, data: [] });

    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i");
    if (type === "PRODUCT") {
      const items = await Product.find({ name: { $regex: regex } }, { name: 1 }).sort({ createdAt: -1 }).limit(10).lean();
      return res.json({ success: true, data: items.map(p => ({ id: p._id, name: p.name })) });
    } else {
      const items = await Category.find({ name: { $regex: regex } }, { name: 1 }).sort({ createdAt: -1 }).limit(10).lean();
      return res.json({ success: true, data: items.map(c => ({ id: c._id, name: c.name })) });
    }
  } catch (err) {
    console.error("searchTargets error:", err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};