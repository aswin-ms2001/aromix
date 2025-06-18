import express from "express";
import {adminSessionMiddleware} from "../config/session.js";
import * as adminController from "../controller/adminController.js";
import adminAuthMiddleware from "../middleware/authMiddleware/adminAuthMiddleware.js";
import { adminLoginSession } from "../middleware/loginSessionHandler/loginSessionHandlerAdmin.js";
const adminRouter = express.Router();

adminRouter.use(adminSessionMiddleware);

adminRouter.get("/login",adminLoginSession ,adminController.loginPage);
adminRouter.post("/login", adminController.login);
adminRouter.get("/dashboard", adminAuthMiddleware, adminController.dashboard);
adminRouter.get("/logout", adminAuthMiddleware, adminController.logout);
adminRouter.post("/logout", adminAuthMiddleware, adminController.logoutConfirm);

export default adminRouter;