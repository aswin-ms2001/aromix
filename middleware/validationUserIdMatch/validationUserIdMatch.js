export const validateUserIdMatch = (req, res, next) => {
  const userIdFromParams = req.params.id;
  const userIdFromSession = String(req.user._id);
  if(!userIdFromParams || ! userIdFromSession){
    next();
  }else{
      if (userIdFromParams !== userIdFromSession) {
          return res.render("error.ejs");
      } else {
          next();
      };
  }; 
};
