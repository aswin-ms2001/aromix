import express from 'express';
import userRoutes from './userRoutes.js';
import productRoutes from './adminProductRoutes.js';
import adminUserRouter from './adminUserRoutes.js';
import { landingPageView } from "../controller/userController.js";
// import orderRoutes from './orderRoutes.js';
import adminRoutes from './adminRoutes.js';
import adminCategoryRoutes from "./adminCategoryRoutes.js";
import userProducts from './userProducts.js';
import passport from "../config/passport.js";
import currentUser from "../middleware/userIdentification/currentUser.js";
import userProfile from './userProfileRoutes.js';
import userAddress from './userAddressRoutes.js';
import { userSessionMiddleware } from "../config/session.js";
const userDetails = [userSessionMiddleware,passport.initialize(),passport.session(),currentUser]

const router = express.Router();


router.get('/', ...userDetails, landingPageView);

router.use('/admin', adminRoutes);
router.use('/admin-users', adminUserRouter);
router.use('/products', productRoutes);
router.use("/adminCategory",adminCategoryRoutes);
router.use('/users', userRoutes);
router.use("/users-products", userProducts);
router.use("/users-profile",userProfile);
router.use("/users-address",userAddress);

// router.use('/orders', orderRoutes);


export default router;