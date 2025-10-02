import express from "express";
import {adminSessionMiddleware} from "../config/session.js";
import * as adminController from "../controller/adminController.js";
import adminAuthMiddleware from "../middleware/authMiddleware/adminAuthMiddleware.js";
import { pageNotFound } from "../middleware/errorMiddleware/pageNotFound.js";

const categoryRouter = express.Router();

categoryRouter.use(adminSessionMiddleware);

categoryRouter.get("/category",adminAuthMiddleware, adminController.categoryFront);
categoryRouter.get("/add-category",adminAuthMiddleware, adminController.addCategory);
categoryRouter.post("/add-category",adminAuthMiddleware, adminController.addCategoryPost);
categoryRouter.put('/block/:id',adminAuthMiddleware, adminController.blockCategory);
categoryRouter.get('/editCategory/:id',adminAuthMiddleware, adminController.getEditCategory);
categoryRouter.put('/editCategory/:id',adminAuthMiddleware, adminController.getEditCategoryPost);
categoryRouter.use(pageNotFound);

export default categoryRouter;