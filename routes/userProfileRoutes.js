import express from "express";
import * as userProfileContoller from "../controller/userProfileController.js";
import { userSessionMiddleware } from "../config/session.js";
import { ensureAuthenticated} from "../middleware/authMiddleware/userAuthMiddleware.js";
import passport from "../config/passport.js";
import currentUser from "../middleware/userIdentification/currentUser.js";
import { validateUserIdMatch } from "../middleware/validationUserIdMatch/validationUserIdMatch.js";
import { pageNotFound } from "../middleware/errorMiddleware/pageNotFound.js";



const userProfile = express.Router();

userProfile.use(userSessionMiddleware);
userProfile.use(passport.initialize());
userProfile.use(passport.session());
userProfile.use(currentUser);

userProfile.get("/profile-front/:id" ,ensureAuthenticated, validateUserIdMatch,userProfileContoller.userProfileFront);
userProfile.put('/send-password-otp/:id',ensureAuthenticated,userProfileContoller.userPasswordOtp);
userProfile.put("/verify-password-otp/:id",ensureAuthenticated,userProfileContoller.userPasswordVerification);
userProfile.put('/send-email-verification/:id',ensureAuthenticated,userProfileContoller.userEmailVerification);
userProfile.put("/update-user-email/:id",ensureAuthenticated,userProfileContoller.updateUserEmail)
userProfile.put("/update-user-name-phone/:id",ensureAuthenticated,userProfileContoller.updateUserNameAndPhone)
userProfile.use(pageNotFound)

export default userProfile;
