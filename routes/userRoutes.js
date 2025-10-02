import express from "express";
import * as userController from "../controller/userController.js";
import { userSessionMiddleware } from "../config/session.js";
import { ensureAuthenticated} from "../middleware/authMiddleware/userAuthMiddleware.js";
import { userLoginSession } from "../middleware/loginSessionHandler/loginSessionHandlerUser.js";
import passport from "../config/passport.js"
import currentUser from "../middleware/userIdentification/currentUser.js";
import flash from "connect-flash"
import { pageNotFound } from "../middleware/errorMiddleware/pageNotFound.js";


const userRoutes = express.Router();


userRoutes.use(userSessionMiddleware);
userRoutes.use(passport.initialize());
userRoutes.use(passport.session());
userRoutes.use(flash());
userRoutes.use(currentUser);

userRoutes.get("/login",userLoginSession,userController.userloginPage);
userRoutes.post("/login", userController.postLogin);
userRoutes.get("/google",userLoginSession,userController.googleAuthentication);
userRoutes.get("/google/callback",userController.googleRedirect);
userRoutes.get("/signup",userController.signupPage);
userRoutes.post("/signup",userController.signup);
userRoutes.post("/verifyOtp",userController.verifyOtp);
userRoutes.post("/resendOtp",userController.resentOtp);
userRoutes.get("/logoutPage", ensureAuthenticated,userController.logoutPage);
userRoutes.post("/logout", ensureAuthenticated,userController.logout);
userRoutes.get("/forgot-password",userController.forgotPasswordGet);
userRoutes.post("/forgot-password",userController.forgotPasswordPost);
userRoutes.post("/verify-reset-otp",userController.verifyResetOtp);
userRoutes.put("/update-password",userController.updatePassword);
userRoutes.post("/resendResetOtp",userController.resendResetOtp)
userRoutes.use(pageNotFound);


export default userRoutes;