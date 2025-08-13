import mongoose from "mongoose";
import Offer from "../../../model/offer.js";

export const productOfferFinder = async(productId,categoryId)=>{
    try{
        if(!mongoose.Types.ObjectId.isValid(productId)) return null;
        if(!mongoose.Types.ObjectId.isValid(categoryId)) return null;
        productId = new mongoose.Types.ObjectId(productId)
        console.log(productId, categoryId)
        // console.log("Entered")
        const offerDetails = await Offer.aggregate([
        {
            $match:{
                $or:[{productId},{categoryId}],
                isActive:true
            }
        },
        {
            $sort:{
                discountPercent:-1
            }
        },
        {
            $limit:1
        },
        {
            $project:{
                _id:0,
                discountPercent:1
            }
        }
    ]);
    // console.log(offerDetails)
        if(offerDetails.length<1){
            return null;
        }else{
            return offerDetails[0].discountPercent;
        }
        
    }catch(err){
        console.log(err);
        return null;
    }
}

export const productActiveOfferLinker = async (product)=>{
    try{
        const updatedProducts = await Promise.all(
            product.map(async(ele)=>{
                try{
                    // console.log(ele)
                    const offer = await productOfferFinder(ele._id,ele.categoryId);
                    return {
                        ...ele,offer
                    }
                }catch(err){
                    console.log(err);
                    return {
                        ...ele,offer:null
                    }
                }
            })
        )

        return updatedProducts;
    }catch(err){
        console.log(err);
        product;
    }
}