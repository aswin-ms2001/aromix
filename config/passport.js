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
          return done(null, false);
        }
  
        if (user.authType !== 'local') {
          return done(null, false);
        }
  
        if (!user.isVerified) {
          return done(null, false);
        }

        if (user.blocked) return done(null, false);
  
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
          return done(null, false);
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
    callbackURL: "/users/google/callback",


},async(accessToken,refreshToken,profile,done)=>{
    // console.log("Google OAuth Profile:", profile);
    try{
        const email = profile.emails[0].value;
        let user = await User.findOne({email});
        if(user){
            if(user.authType != "google"){
                // console.log("Error: This email is registered with local Authentication.");
                return done(new Error("This email is registered with local Authentication"),null);
            }

            if (user.blocked) return done(null, false);
            
            // console.log("User logged in:", user);
            return done(null, user); // user login
        }

        //new Google signup
        // console.log("Creating new Google user...");
        user = await User.create({
            name:profile.displayName,
            email:email,
            authType:"google",
            isVerified:true
        });
        // console.log("New user created:", user);
        return done(null,user);

    }catch(err){
        // console.error("Error in Google authentication:", err);
        done(err, null)
    }

}
))

passport.serializeUser((user,done)=>{
    // console.log("Serializing user:", user);
    done(null,user.id)
})

passport.deserializeUser(async (id,done)=>{
    try{
        const user = await User.findById(id);
        // console.log("Deserialized user:", user);
        done(null,user)
    }catch(err){
        // console.error("Error during deserialization:", err);
        done(err,null)
    }

})

export default passport;