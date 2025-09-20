import express from "express";
import { userSessionMiddleware } from "../config/session.js";
import { ensureAuthenticated} from "../middleware/authMiddleware/userAuthMiddleware.js";
import passport from "../config/passport.js";
import currentUser from "../middleware/userIdentification/currentUser.js";
import * as walletController  from "../controller/userWalletController.js";

const userWallet = express.Router();

userWallet.use(userSessionMiddleware);
userWallet.use(passport.initialize());
userWallet.use(passport.session());
userWallet.use(currentUser);
userWallet.use(ensureAuthenticated);


userWallet.get("/user-wallet-front",walletController.userWalletFront);
userWallet.get("/user-referral",walletController.userReferralFront);

export default userWallet ;
