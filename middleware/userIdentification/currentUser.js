const currentUser = (req, res, next) => {
    if (req.user) {
        if (!req.user.blocked) {
            res.locals.currentUser = req.user;
            return next();
        } else {
            req.logout(() => {
                req.session.destroy(() => {
                    res.clearCookie('userSessionId');
                    return next(); 
                });
            });
        }
    } else {
        res.locals.currentUser = null;
        return next();
    }
};

export default currentUser;