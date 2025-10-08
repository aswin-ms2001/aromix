import Product from "../../../model/product.js";

export const isSufficient = async(items)=>{
    try{

        const insufficientStock = await Product.aggregate([
        {
            $match: {
            _id: { $in: items.map(i => i.productId) }
            }
        },
        { $unwind: "$variants" },
        {
            $match: {
            "variants._id": { $in: items.map(i => i.variantId) }
            }
        },
        {
            $addFields: {
            requestedQuantity: {
                $getField: {
                field: "quantity",
                input: {
                    $arrayElemAt: [
                    {
                        $filter: {
                        input: items,
                        as: "it",
                        cond: {
                            $eq: ["$$it.variantId", "$variants._id"]
                        }
                        }
                    },
                    0
                    ]
                }
                }
            }
            }
        },
        {
            $match: {
            $expr: { $lt: ["$variants.stock", "$requestedQuantity"] }
            }
        },
        {
            $project: {
            _id: 1,
            name: 1,
            "variants._id": 1,
            "variants.stock": 1,
            requestedQuantity: 1
            }
        }
        ]);

        if (insufficientStock.length > 0) {
            return false
        }else{
            return true
        }
    }catch(err){
        return false
    }
}