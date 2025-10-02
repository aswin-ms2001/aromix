import express from "express";
import { adminSessionMiddleware } from "../config/session.js";
import * as adminCouponController from "../controller/adminCouponController.js";
import adminAuthMiddleware from "../middleware/authMiddleware/adminAuthMiddleware.js";
import { pageNotFound } from "../middleware/errorMiddleware/pageNotFound.js";


const adminCouponRoutes = express.Router();
adminCouponRoutes.use(adminSessionMiddleware);
adminCouponRoutes.get("/admin-coupon-front", adminAuthMiddleware, adminCouponController.adminCouponFront);
adminCouponRoutes.post("/create", adminAuthMiddleware, adminCouponController.createCoupon);
adminCouponRoutes.put("/:id", adminAuthMiddleware, adminCouponController.updateCoupon);
adminCouponRoutes.put("/:id/toggle", adminAuthMiddleware, adminCouponController.toggleCouponActive);
adminCouponRoutes.get("/generate-code", adminAuthMiddleware, adminCouponController.generateCode);
adminCouponRoutes.use(pageNotFound);

export default adminCouponRoutes;
