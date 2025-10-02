import express from "express";
import * as userAddressContoller from "../controller/userAddressController.js";
import { userSessionMiddleware } from "../config/session.js";
import { ensureAuthenticated} from "../middleware/authMiddleware/userAuthMiddleware.js";
import passport from "../config/passport.js";
import { validateUserIdMatch } from "../middleware/validationUserIdMatch/validationUserIdMatch.js";
import currentUser from "../middleware/userIdentification/currentUser.js";
import { pageNotFound } from "../middleware/errorMiddleware/pageNotFound.js";


const userAddress = express.Router();

userAddress.use(userSessionMiddleware);
userAddress.use(passport.initialize());
userAddress.use(passport.session());
userAddress.use(currentUser);
userAddress.use(ensureAuthenticated);

userAddress.get("/address-front/:id",validateUserIdMatch,userAddressContoller.userAddressFront);
userAddress.post("/create-new-address/:id",validateUserIdMatch,userAddressContoller.createNewAddress);
userAddress.patch("/set-default-address/:id",validateUserIdMatch,userAddressContoller.setDefaultAddress);
userAddress.put("/edit-address/:id",validateUserIdMatch,userAddressContoller.editAddress);
userAddress.delete("/delete-address/:id",validateUserIdMatch,userAddressContoller.deleteAddress);
userAddress.use(pageNotFound);

export default userAddress;
