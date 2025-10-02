import express from "express";
import {adminSessionMiddleware} from "../config/session.js";
import * as adminOfferController from "../controller/adminOfferController.js";
import adminAuthMiddleware from "../middleware/authMiddleware/adminAuthMiddleware.js";
import { pageNotFound } from "../middleware/errorMiddleware/pageNotFound.js";


const adminOfferRoutes = express.Router();

adminOfferRoutes.use(adminSessionMiddleware);

adminOfferRoutes.get("/admin-offer-front", adminAuthMiddleware, adminOfferController.adminOfferFront);
adminOfferRoutes.post("/create", adminAuthMiddleware, adminOfferController.createOffer);
adminOfferRoutes.put("/:id", adminAuthMiddleware, adminOfferController.updateOffer);
adminOfferRoutes.put("/:id/toggle", adminAuthMiddleware, adminOfferController.toggleOfferActive);
adminOfferRoutes.get("/search-targets", adminAuthMiddleware, adminOfferController.searchTargets);
adminOfferRoutes.use(pageNotFound);

export default adminOfferRoutes;