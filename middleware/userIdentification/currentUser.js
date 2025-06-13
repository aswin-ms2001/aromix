const currentUser = (req,res,next)=>{
    res.locals.currentUser = req.user || null;
    next();
}

export default currentUser;