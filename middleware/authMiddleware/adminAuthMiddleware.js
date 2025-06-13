const adminAuthMiddleware = (req,res,next)=>{
    if(req.session && req.session.admin){
        next();
    }else{
        res.redirect("/admin/login");
    }
}

export default adminAuthMiddleware;
