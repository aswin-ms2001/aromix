import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as LocalStrategy } from "passport-local";
import dotenv from "dotenv";
import User from "../model/user.js";

dotenv.config()

passport.use(new LocalStrategy(
    { usernameField: 'email' }, 
    async (email, password, done) => {
      try {
        const user = await User.findOne({ email });
  
        if (!user) {
          return done(null, false, { message: "User not found" });
        }
  
        if (user.authType !== 'local') {
          return done(null, false, { message: "This email is registered with Google login" });
        }
  
        if (!user.isVerified) {
          return done(null, false, { message: "Please verify your email" });
        }

        if (user.blocked) return done(null, false, { message: "Your account is blocked" });
  
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
          return done(null, false, { message: "Incorrect password" });
        }
  
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  ));

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "https://aromixx.shop/users/google/callback",


},async(accessToken,refreshToken,profile,done)=>{

    try{
        const email = profile.emails[0].value;
        let user = await User.findOne({email});
        if(user){
            if(user.authType != "google"){
      
                return done(null,false,{message:"User is not Registered Using Google Auth"});
            }

            if (user.blocked) return done(null, false,{message:"User is Blocked"});
            
            
            return done(null, user); // user login
        }

        //new Google signup
       
        user = await User.create({
            name:profile.displayName,
            email:email,
            authType:"google",
            isVerified:true
        });
        
        return done(null,user);

    }catch(err){
        
        done(err, null)
    }

}
))

passport.serializeUser((user,done)=>{
    
    done(null,user.id)
})

passport.deserializeUser(async (id,done)=>{
    try{
        const user = await User.findById(id);
        
        done(null,user)
    }catch(err){
       
        done(err,null)
    }

})

export default passport;