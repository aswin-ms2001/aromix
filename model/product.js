import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
    name:{
        type: String,
        required: true,
        trim : true,
    },
    price:{
        type: Number,
        required: true,
        min: [0,"Price must be greater than 0"],

    },
    catergory:{
        type: String,
        required: true,
        enum: ["Woody","Citrus","Floral","Fruity","Floral","Oriental","Fresh"]
    },
    image:{
        type:[String],
        required: true,
    },
    stock:{
        type: Number,
        required: true,
        min: [0,"Stock must be greater than or equal to 0"],
    
    },
    description:{
        type: String,
        required: true,
        trim : true
    },
    createdAt:{
        type: Date,
        default: Date.now
    }
})

const product = mongoose.model("Product", productSchema);
export default product;