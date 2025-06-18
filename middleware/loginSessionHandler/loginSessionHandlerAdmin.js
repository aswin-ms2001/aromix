export const adminLoginSession = (req,res,next)=>{
    if(req.session && req.session.admin){
        return res.redirect("/admin/dashboard");
    }else{
        next()
    }
}