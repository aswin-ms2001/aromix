import express from "express";
import {adminSessionMiddleware} from "../config/session.js";
import * as adminController from "../controller/adminController.js";
import adminAuthMiddleware from "../middleware/authMiddleware/adminAuthMiddleware.js";


const productRouter = express.Router();

productRouter.use(adminSessionMiddleware);

productRouter.get("/showProducts"  ,adminAuthMiddleware, adminController.productDetails)
productRouter.get("/addProduct",adminAuthMiddleware, adminController.addProduct);
productRouter.post("/test" ,adminAuthMiddleware,  ...adminController.uploader);
productRouter.post("/add",adminAuthMiddleware, ...adminController.addProductPost);
productRouter.put("/block/:id",adminAuthMiddleware, adminController.blockProduct);
productRouter.get("/edit/:id",adminAuthMiddleware, adminController.editProduct);
productRouter.put("/edit/:id",adminAuthMiddleware, adminController.editProductPost);
productRouter.post("/add-new-variants/:productId",adminAuthMiddleware, adminController.addNewVariants);

export default productRouter;