import express from "express";
import {adminSessionMiddleware} from "../config/session.js";
import * as adminUserController from "../controller/adminUserController.js";
import adminAuthMiddleware from "../middleware/authMiddleware/adminAuthMiddleware.js";
const adminUserRouter = express.Router();

adminUserRouter.use(adminSessionMiddleware);

adminUserRouter.get("/show",adminAuthMiddleware, adminUserController.showUsers);
adminUserRouter.put("/block/:id",adminAuthMiddleware, adminUserController.block);

export default adminUserRouter