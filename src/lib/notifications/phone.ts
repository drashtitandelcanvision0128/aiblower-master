/** Indian 10-digit mobile to E.164 +91… */
export function indiaPhoneToE164(digits10: string) {
  const d = digits10.replace(/\D/g, "");
  if (!/^[6-9]\d{9}$/.test(d)) {
    throw new Error("Invalid Indian mobile number");
  }
  return `+91${d}`;
}
