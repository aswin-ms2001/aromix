import express from "express";
import * as userProduct from "../controller/userProductController.js";
import { userSessionMiddleware } from "../config/session.js";
import { ensureAuthenticated} from "../middleware/authMiddleware/userAuthMiddleware.js";
import passport from "../config/passport.js";
import currentUser from "../middleware/userIdentification/currentUser.js";
import { pageNotFound } from "../middleware/errorMiddleware/pageNotFound.js";


const userProducts = express.Router();

userProducts.use(userSessionMiddleware);
userProducts.use(passport.initialize());
userProducts.use(passport.session());
userProducts.use(currentUser);

userProducts.get("/discover", ensureAuthenticated ,userProduct.discoverPage);
userProducts.get("/products/:id", ensureAuthenticated , userProduct.productDetails);
userProducts.use(pageNotFound);

export default userProducts;