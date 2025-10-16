import User from "../model/user.js";
import Address from "../model/address.js";
import { HTTP_STATUS } from "../utils/httpStatus.js";

/**
 * @async
 * @function userAddressFront
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
export const userAddressFront = async (req,res)=>{
 try {
    const id = req.params.id;

    const user = await User.findById(id);
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).render("error.ejs", { message: "User not found" });
    }

    const addresses = await Address.find({ userId: id }).lean();

    const defaultAddress = addresses.find(addr => addr.isDefault);
    const otherAddresses = addresses.filter(addr => !addr.isDefault);

    res.render("user-views/user-account/user-profile/user-address.ejs", {
      user,
      defaultAddress,
      otherAddresses,
      activePage: "addressBook"
    });

  } catch (err) {
    console.error(err);
    res.render("error.ejs", { message: "Something went wrong" });
  };
};


/**
 * @async
 * @function createNewAddress
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
export const createNewAddress = async (req, res) => {

  try {
    const userId = req.params.id;



    const {
      name,
      house,
      street,
      city,
      state,
      country,
      mobile,
      pincode,
      isDefault = false
    } = req.body;

    const phonePattern = /^[0-9]{10}$/;
    const pinPattern = /^[0-9]{6}$/;

    if (!name || !house || !street || !city || !state || !country || !mobile || !pincode) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: "All fields are required." });
    }

    if (!phonePattern.test(mobile)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: "Invalid mobile number." });
    }

    if (!pinPattern.test(pincode)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: "Invalid pincode." });
    }




   
    const newAddress = new Address({
      userId,
      name,
      house,
      street,
      city,
      state,
      country,
      mobile,
      pincode,
    });

    
    await newAddress.save();
  
    return res.status(HTTP_STATUS.CREATED).json({ success: true, message: "Address created successfully." , address:newAddress});

  } catch (err) {
    console.error("Create Address Error:", err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Server error." });
  }
};

/**
 * @async
 * @function setDefaultAddress
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
export const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.params.id;
    const { selectedDefaultAddressId } = req.body;

    if (!selectedDefaultAddressId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: "No address selected" });
    }


    await Address.updateMany(
      { userId, isDefault: true },
      { $set: { isDefault: false } }
    );

  
    const updated = await Address.findOneAndUpdate(
      { _id: selectedDefaultAddressId, userId },
      { $set: { isDefault: true } },
      { new: true }
    );

    if (!updated) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: "Address not found or unauthorized" });
    }

    res.status(HTTP_STATUS.OK).json({
      success: true,
      message: "Default address updated successfully",
    });

  } catch (error) {
    console.error("Set default address error:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal server error" });
  }
};


/**
 * @async
 * @function editAddress
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
export const editAddress = async (req, res) => {
  try {
    const userId = req.params.id;
    const { payload, addressId } = req.body;

    if (!addressId || !payload) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({success: false, message: "Invalid request" });
    }

   
    const address = await Address.findOne({ _id: addressId, userId });

    if (!address) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({success: false, message: "Address not found" });
    }

    
    address.name = payload.name;
    address.house = payload.house;
    address.street = payload.street;
    address.city = payload.city;
    address.state = payload.state;
    address.country = payload.country;
    address.mobile = payload.mobile;
    address.pincode = payload.pincode;

    await address.save();

    return res.status(HTTP_STATUS.OK).json({ success: true, message: "Address updated successfully",address });

  } catch (err) {
    console.log("Edit Address Error:", err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({success: false, message: "Something went wrong" });
  }
};


/**
 * @async
 * @function deleteAddress
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
export const deleteAddress = async (req, res) => {
  try {
    const userId = req.params.id;
    const { addressId } = req.body;

    if (!addressId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: "Address ID is required." });
    }

    const deleted = await Address.findOneAndDelete({ _id: addressId, userId });

    if (!deleted) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: "Address not found or already deleted." });
    }

    return res.status(HTTP_STATUS.OK).json({ success: true, message: "Address deleted successfully." });

  } catch (err) {
    console.error("Delete address error:", err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal Server Error." });
  }
};