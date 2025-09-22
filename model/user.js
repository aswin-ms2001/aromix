import mongoose from "mongoose";
import bcrypt from "bcrypt";


const userSchema = new mongoose.Schema({
    name:{
        type:String,
        trim:true
    },
    email:{
        type:String,
        required:true,
        unique:true,
        trim:true
    },
    password:{
        type:String,
        trim:true
    },
    blocked:{
        type:Boolean,
        default:false,
    },
    authType:{
        type:String,
        enum:["local","google"],
        require:true
    },
    phoneNumber:{
        type:String,
        default:null,
        trim:true
    },
    otp:{
        type:String,
        trim:true
    },
    otpExpires:{
        type:Date,
    },
    isVerified:{
        type:Boolean,
        default:false
    },
    resetOtp: {
        type: String,
        trim: true
    },
    resetOtpExpires: {
        type: Date
    },
    referralCode:{
        type:String,
        unique:true,
        sparse: true,
        trim:true
    },
    referredBy:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        default:null
    }

    
},{
    timestamps:true
});


userSchema.methods.comparePassword = function(inputPassword){
    return bcrypt.compare(inputPassword,this.password);
}

const User = mongoose.model("Users",userSchema);

export default User;