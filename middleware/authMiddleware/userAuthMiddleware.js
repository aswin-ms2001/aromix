// Check if user is logged in
export function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
 
    if (req.user.blocked) {
      req.logout(() => {
        req.session.destroy(() => {
          res.clearCookie('userSessionId'); 
          return res.redirect('/users/login');
        });
      });
    } else {
      return next(); 
    }
  } else {
    res.redirect('/users/login');
  }
}

