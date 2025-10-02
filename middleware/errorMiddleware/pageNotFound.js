export const pageNotFound = (req, res) => {
  res.status(404).render("error", {
    message: "Page not found",
    url: req.originalUrl,
  });
}