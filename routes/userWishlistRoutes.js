import express from "express";
import { userSessionMiddleware } from "../config/session.js";
import { ensureAuthenticated} from "../middleware/authMiddleware/userAuthMiddleware.js";
import passport from "../config/passport.js";
import currentUser from "../middleware/userIdentification/currentUser.js";
import * as wishlistController  from "../controller/wishlistController.js";

const userWishlist = express.Router();

userWishlist.use(userSessionMiddleware);
userWishlist.use(passport.initialize());
userWishlist.use(passport.session());
userWishlist.use(currentUser);
userWishlist.use(ensureAuthenticated);

userWishlist.get("/user-wishlist-front",wishlistController.userWishlist);
userWishlist.post("/add-to-wishlist/:productId/:variantId",wishlistController.addToWishlist);
userWishlist.delete("/delete-from-wishlist/:productId/:variantId",wishlistController.deleteFromWishlist);



export default userWishlist ;
