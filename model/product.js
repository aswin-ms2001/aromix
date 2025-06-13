import mongoose from "mongoose";


const variantSchema = new mongoose.Schema({
  volume: { type: Number, required: true },
  price: { type: Number, required: true },
  stock: { type: Number, required: true, min: 0 },
  images: { type: [String], required: true }, 
  description: { type: String, required: true } 
}, { _id: true });


const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category"
  },
  categoryName:{
    type: String,
    required: true
  },
  blocked:{
    type: Boolean,
    default: false
  },
  gender: { type: String, required: true, trim: true },
  variants: [variantSchema]
},
  {
  timestamps: true 
}
);

const Product = mongoose.model("Product", productSchema);
export default Product;