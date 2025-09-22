export function validateCouponPayload(body, isUpdate = false) {
  const errors = [];
  const codePattern = /^[A-Za-z0-9]{6,12}$/;
  const { code, type, discount, minAmount, maxAmount, startAt, endAt } = body;
  if (!code || !codePattern.test(code.trim())) errors.push("Invalid coupon code (6-12 alphanumeric)");
  if (!type || !["PERCENTAGE", "FLAT"].includes(type)) errors.push("Invalid coupon type");
  const disc = Number(discount);
  if (!disc || disc < 1) errors.push("Discount must be at least 1");
  const min = Number(minAmount);
  const max = Number(maxAmount);
  if (isNaN(min) || min < 0) errors.push("Invalid minimum amount");
  if (isNaN(max) || max <= 0 || max < min) errors.push("Invalid maximum amount");
  if (type === "FLAT" && (disc < min*20/100 || disc > min*50/100 )) errors.push("Flat discount must be greater than 20 % and less than 50 % of Minimum");
  if (type === "PERCENTAGE" && (disc <10 || disc > 90))errors.push("Percentage discount must be greater than 90 % and less than 10 %");
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) errors.push("Invalid dates");
  if (start >= end) errors.push("Start date must be before end date");
  const now = new Date();
  if (!isUpdate && start < now) errors.push("Start date cannot be in the past");
  return { errors, start, end };
}

export function generateCouponCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const len = Math.floor(Math.random() * 7) + 6; // 6-12 chars
  let code = '';
  for (let i = 0; i < len; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
