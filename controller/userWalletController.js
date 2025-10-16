import Wallet from "../model/wallet.js";
import { HTTP_STATUS } from "../utils/httpStatus.js";

/**
 * @async
 * @function userWalletFront
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
export const userWalletFront = async (req,res)=>{
  try {
    const userId = req.user._id; // Assuming user is authenticated and stored in req.user
    let wallet = await Wallet.findOne({ userId });
    if(!wallet){
      wallet = new Wallet({userId,balance:0})
    }
   
    wallet.transactions.sort((a,b)=>b.date - a.date);
    // If wallet does not exist, initialize one


    const page = parseInt(req.query.page) || 1; // current page
    const limit = 5; // transactions per page
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const totalTransactions = wallet.transactions.length;
    const totalPages = Math.ceil(totalTransactions / limit);

    // Slice transactions for the current page
    const paginatedTransactions = wallet.transactions.slice(startIndex, endIndex);

    if (!wallet) {
      return res.render("user-views/user-account/user-profile/user-wallet.ejs", {
        user: req.user,
        balance: 0,
        transactions: [],
        activePage:"wallet"
      });
    }

    res.render("user-views/user-account/user-profile/user-wallet.ejs", {
      user: req.user,
      balance: wallet.balance,
      transactions: paginatedTransactions,
      currentPage:page,
      totalPages,
      activePage:"wallet"
    });
  } catch (error) {
    console.error("Error fetching wallet:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render("error.ejs");
  }
}

/**
 * @async
 * @function userReferralFront
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
export const userReferralFront = async (req, res) => {
  try {
    const user = req.user;
    
    // Check if user has a referral code (only for local auth users)
    if (!user.referralCode) {
      return res.render("user-views/user-account/user-profile/user-referral.ejs", {
        user: user,
        referralCode: null,
        activePage: "referral"
      });
    }

    res.render("user-views/user-account/user-profile/user-referral.ejs", {
      user: user,
      referralCode: user.referralCode,
      activePage: "referral"
    });
  } catch (error) {
    console.error("Error fetching referral page:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render("error.ejs");
  }
}