import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
    name:{
        type: String,
        trim: true
    },
    email:{
        type: String,
        required: true,
        unique: true,
    },
    password:{
        type: String,
        required: true,
    }
})

const Admin = mongoose.model("Admin", adminSchema);

export default Admin;