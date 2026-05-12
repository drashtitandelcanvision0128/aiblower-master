import Razorpay from "razorpay";

function cleanEnv(value: string | undefined) {
  if (!value) return "";
  const trimmed = value.trim();
  return trimmed.replace(/^['"]+|['"]+$/g, "");
}

export function getRazorpay() {
  const key_id = cleanEnv(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID);
  const key_secret = cleanEnv(process.env.RAZORPAY_KEY_SECRET);
  if (!key_id || !key_secret) {
    throw new Error("Missing NEXT_PUBLIC_RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET");
  }
  return new Razorpay({ key_id, key_secret });
}
