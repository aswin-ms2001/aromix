import Wallet from "../model/wallet.js";

export const userWalletFront = async (req,res)=>{
  try {
    const userId = req.user._id; // Assuming user is authenticated and stored in req.user
    const wallet = await Wallet.findOne({ userId });

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