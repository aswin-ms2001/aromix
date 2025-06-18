export const userLoginSession = (req,res,next)=>{
    if(req.isAuthenticated()){
        res.redirect("/")
    }else{
        next()
    }
}