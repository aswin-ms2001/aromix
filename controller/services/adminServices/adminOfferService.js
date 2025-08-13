export  function validateOfferPayload(body, isUpdate = false) {
  const errors = [];
  const namePattern = /^(?![ .])(?!.*[ .]{2})[A-Za-z0-9 .]{7,}$/; // min 7, no leading dot/space, no multiple consecutive dot/space

  const { name, offerType, discountPercent, startAt, endAt, productId, categoryId } = body;
  if (!name || !namePattern.test(name.trim())) errors.push("Invalid offer name");
  if (!offerType || !["PRODUCT", "CATEGORY"].includes(offerType)) errors.push("Invalid offer type");
  const percent = Number(discountPercent);
  if (!percent || percent < 1 || percent > 90) errors.push("Discount must be between 1 and 90");
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) errors.push("Invalid dates");
  if (start >= end) errors.push("Start date must be before end date");
  const now = new Date();
  if (!isUpdate && start < now) errors.push("Start date cannot be in the past");
  if (offerType === "PRODUCT" && !productId) errors.push("Product is required for product offer");
  if (offerType === "CATEGORY" && !categoryId) errors.push("Category is required for category offer");
  return { errors, start, end, percent };
}
