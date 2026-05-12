import twilio from "twilio";

function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new Error("Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN");
  }
  return twilio(sid, token);
}

export async function sendTwilioWhatsApp(params: { toE164: string; body: string }) {
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!from) {
    throw new Error("Missing TWILIO_WHATSAPP_FROM (e.g. whatsapp:+14155238886)");
  }
  const client = getClient();
  const to = params.toE164.startsWith("whatsapp:") ? params.toE164 : `whatsapp:${params.toE164}`;
  await client.messages.create({
    from,
    to,
    body: params.body,
  });
}

export async function sendTwilioSms(params: { toE164: string; body: string }) {
  const from = process.env.TWILIO_SMS_FROM;
  if (!from) {
    throw new Error("Missing TWILIO_SMS_FROM");
  }
  const client = getClient();
  await client.messages.create({
    from,
    to: params.toE164,
    body: params.body,
  });
}
