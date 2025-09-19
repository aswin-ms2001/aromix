export default function generateReferralCode() {
  const length = 8;  
  // Allowed characters (A-Z without O/I, digits without 0/1)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars[randomIndex];
  }

  return code;
}