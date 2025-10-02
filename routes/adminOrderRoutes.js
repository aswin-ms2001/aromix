import express from "express";
import {adminSessionMiddleware} from "../config/session.js";
import * as adminOrderController from "../controller/adminOrderController.js";
import adminAuthMiddleware from "../middleware/authMiddleware/adminAuthMiddleware.js";
import { pageNotFound } from "../middleware/errorMiddleware/pageNotFound.js";


const adminOrderRoutes = express.Router();

adminOrderRoutes.use(adminSessionMiddleware);

adminOrderRoutes.get("/admin-order-details", adminAuthMiddleware, adminOrderController.adminOrderFront);
adminOrderRoutes.get("/order-details/:id", adminAuthMiddleware, adminOrderController.getOrderDetails);
adminOrderRoutes.put("/update-order-status/:id", adminAuthMiddleware, adminOrderController.updateOrderStatus);
adminOrderRoutes.post("/verify-return/:orderId/:variantId", adminAuthMiddleware, adminOrderController.verifyReturn);
adminOrderRoutes.use(pageNotFound);

export default adminOrderRoutes;