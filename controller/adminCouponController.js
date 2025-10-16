import Coupon from "../model/coupon.js";
import { validateCouponPayload, generateCouponCode } from "./services/adminServices/adminCouponService.js";
import { HTTP_STATUS } from "../utils/httpStatus.js";

/**
 * @async
 * @function adminCouponFront
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
export const adminCouponFront = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;
    const search = (req.query.search || "").trim();
    const type = req.query.type || ""; // PERCENTAGE | FLAT | ''
    const status = req.query.status || ""; // active | inactive | ''

    const query = {};
    if (search) query.code = { $regex: search, $options: "i" };
    if (type) query.type = type;
    if (status === "active") query.isActive = true;
    if (status === "inactive") query.isActive = false;

    const totalCoupons = await Coupon.countDocuments(query);
    const totalPages = Math.ceil(totalCoupons / limit);

    const coupons = await Coupon.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.render("admin-views/adminCoupon.ejs", {
      coupons,
      currentPage: page,
      totalPages,
      totalCoupons,
      search,
      type,
      status,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page + 1,
      prevPage: page - 1,
    });
  } catch (err) {
    console.error("Error in adminCouponFront:", err);
    return res.render("error.ejs");
  }
};

/**
 * @async
 * @function createCoupon
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
export const createCoupon = async (req, res) => {
  try {
    const { errors, start, end } = validateCouponPayload(req.body, false);
    if (errors.length) return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: errors[0] });

    // Unique code
    const existing = await Coupon.findOne({ code: { $regex: `^${req.body.code.trim()}$`, $options: "i" } });
    if (existing) return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: "Coupon code already exists" });

    const coupon = new Coupon({
      code: req.body.code.trim(),
      type: req.body.type,
      discount: req.body.discount,
      minAmount: req.body.minAmount,
      maxAmount: req.body.maxAmount,
      startAt: start,
      endAt: end,
      isActive: false,
      isNonBlocked: true,
      usedBy: [],
      createdBy: req.admin?._id || null
    });
    await coupon.save();
    res.json({ success: true, message: "Coupon created" });
  } catch (err) {
    console.error("createCoupon error:", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * @async
 * @function updateCoupon
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
export const updateCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    const coupon = await Coupon.findById(couponId);
    if (!coupon) return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: "Coupon not found" });

    const { errors, start, end } = validateCouponPayload(req.body, true);
    if (errors.length) return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: errors[0] });

    // Unique code check excluding self
    const existing = await Coupon.findOne({
      _id: { $ne: couponId },
      code: { $regex: `^${req.body.code.trim()}$`, $options: "i" },
    });
    if (existing) return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: "Coupon code already in use" });

    coupon.code = req.body.code.trim();
    coupon.type = req.body.type;
    coupon.discount = req.body.discount;
    coupon.minAmount = req.body.minAmount;
    coupon.maxAmount = req.body.maxAmount;
    coupon.startAt = start;
    coupon.endAt = end;
    // Keep isActive as-is; cron/toggle handles it
    await coupon.save();
    res.json({ success: true, message: "Coupon updated" });
  } catch (err) {
    console.error("updateCoupon error:", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * @async
 * @function toggleCouponActive
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
export const toggleCouponActive = async (req, res) => {
  try {
    const couponId = req.params.id;
    const { activate } = req.body; // true|false
    const coupon = await Coupon.findById(couponId);
    if (!coupon) return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: "Coupon not found" });
    const now = new Date();
    if (!(coupon.startAt <= now && now <= coupon.endAt)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: "Coupon can only be toggled within its active window" });
    }
    if (activate) {
      coupon.isActive = !!activate;
      coupon.isNonBlocked = true;
    } else {
      coupon.isActive = !!activate;
      coupon.isNonBlocked = false;
    }
    await coupon.save();
    res.json({ success: true, message: `Coupon ${coupon.isActive ? "activated" : "deactivated"}` });
  } catch (err) {
    console.error("toggleCouponActive error:", err);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * @function generateCode
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {void}
 */
export const generateCode = (req, res) => {
  try {
    const code = generateCouponCode();
    res.json({ success: true, code });
  } catch (err) {
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Error generating code" });
  }
};
