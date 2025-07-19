import express from "express";
import * as userCartController from "../controller/userCartController.js"
import { userSessionMiddleware } from "../config/session.js";
import { ensureAuthenticated} from "../middleware/authMiddleware/userAuthMiddleware.js";
import passport from "../config/passport.js";
import { validateUserIdMatch } from "../middleware/validationUserIdMatch/validationUserIdMatch.js";
import currentUser from "../middleware/userIdentification/currentUser.js";

const userCart = express.Router();

userCart.use(userSessionMiddleware);
userCart.use(passport.initialize());
userCart.use(passport.session());
userCart.use(currentUser);
userCart.use(ensureAuthenticated);

userCart.get("/user-cart-front/",userCartController.userCartFront)
userCart.post("/user-add-cart/:productId/:variantId",userCartController.addToCart);
userCart.post("/user-add-cart-wishlist-delete",userCartController.addToCartDeleteFromWishlist);
userCart.patch("/update-quantity/:cartId",userCartController.updateCartQuantity);
userCart.delete("/remove/:cartId",userCartController.deleteCart);


export default userCart ;
