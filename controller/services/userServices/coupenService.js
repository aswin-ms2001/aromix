import mongoose from "mongoose";
import Coupon from "../../../model/coupon.js";

export const userCoupens = async (amount, userId) => {
  try {
    const now = new Date();

    const coupensForUser = await Coupon.aggregate([
      {
        $match: {
          isActive: true,
          isNonBlocked: true,
          startAt: { $lte: now },
          endAt: { $gte: now },
          minAmount: { $lte: amount },
          maxAmount: { $gte: amount },
          usedBy: { $ne: new mongoose.Types.ObjectId(userId) } // userId not in usedBy
        }
      },
      {
        $project: {
          code: 1,
          type: 1,
          discount: 1,
          minAmount: 1,
          maxAmount: 1,
          startAt: 1,
          endAt: 1,
        }
      }
    ]);

    return coupensForUser;
  } catch (err) {
    console.error("Error fetching user coupons:", err);
    throw err;
  }
};