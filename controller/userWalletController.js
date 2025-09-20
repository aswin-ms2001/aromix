import Wallet from "../model/wallet.js";

export const userWalletFront = async (req,res)=>{
  try {
    const userId = req.user._id; // Assuming user is authenticated and stored in req.user
    let wallet = await Wallet.findOne({ userId });
    if(!wallet){
      wallet = new Wallet({userId,balance:0})
    }
    console.log(wallet)
    wallet.transactions.sort((a,b)=>b.date - a.date);
    // If wallet does not exist, initialize one
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
      transactions: wallet.transactions,
      activePage:"wallet"
    });
  } catch (error) {
    console.error("Error fetching wallet:", error);
    res.status(500).send("Server Error");
  }
}

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
    res.status(500).send("Server Error");
  }
}