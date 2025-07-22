import express from "express";
import * as userOderController from "../controller/userOderController.js"
import { userSessionMiddleware } from "../config/session.js";
import { ensureAuthenticated} from "../middleware/authMiddleware/userAuthMiddleware.js";
import passport from "../config/passport.js";
import { validateUserIdMatch } from "../middleware/validationUserIdMatch/validationUserIdMatch.js";
import currentUser from "../middleware/userIdentification/currentUser.js";

const userOder = express.Router();

userOder.use(userSessionMiddleware);
userOder.use(passport.initialize());
userOder.use(passport.session());
userOder.use(currentUser);
userOder.use(ensureAuthenticated);

userOder.get("/user-checkout",userOderController.userCheckOut)

export default userOder ;
