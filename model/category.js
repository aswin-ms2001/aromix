import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true 
  },
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product"
  }],
  blocked: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true 
});

const Category = mongoose.model("Category", categorySchema);
export default Category;