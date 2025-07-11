export const validateUserIdMatch = (req, res, next) => {
  const userIdFromParams = req.params.id;
  const userIdFromSession = String(req.user._id);
  if(!userIdFromParams || ! userIdFromSession){
    next();
  }else{
      if (userIdFromParams !== userIdFromSession) {
          return res.status(409).json({
              success: false,
              message: "You are not allowed to perform this action"
          });
      } else {
          next();
      };
  }; 
};
