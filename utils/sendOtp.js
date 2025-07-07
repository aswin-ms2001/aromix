import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config()

export async function sendOtpEmail(email,otp) {
    const transporter = nodemailer.createTransport({
        service:"gmail",
        auth:{
            user:process.env.EMAIL_USER,
            pass:process.env.EMAIL_PASS
        }
    });
    const mailOptions = {
        from:`"Aromix" <no-reply@aromix.com>`,
        to:email,
        subject:"OTP Verfication",
        html:`<p>Your otp is <b>${otp}</b>.It is only valid for 1 minute.</p>`
    };

    await transporter.sendMail(mailOptions);
}

export async function sendOtpPassword(email,otp) {
    const transporter = nodemailer.createTransport({
        service:"gmail",
        auth:{
            user:process.env.EMAIL_USER,
            pass:process.env.EMAIL_PASS
        }
    });
    const mailOptions = {
        from:`"Aromix" <no-reply@aromix.com>`,
        to:email,
        subject:"Forgot Password OTP ",
        html:`<p>Your otp is for reseting Password is <b>${otp}</b>.It is only valid for 1 minute.</p>`
    };

    await transporter.sendMail(mailOptions);
};

