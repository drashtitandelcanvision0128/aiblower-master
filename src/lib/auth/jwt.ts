import { SignJWT, jwtVerify } from "jose";

export type AdminJwtPayload = {
  sub: string;
  email: string;
};

function getSecretKey() {
  const raw = process.env.ADMIN_SESSION_SECRET?.trim();
  if (!raw || raw.length < 16) {
    throw new Error(
      "ADMIN_SESSION_SECRET must be set to a random string at least 16 characters long.",
    );
  }
  return new TextEncoder().encode(raw);
}

export async function signAdminToken(payload: AdminJwtPayload): Promise<string> {
  const key = getSecretKey();
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);
}

export async function verifyAdminToken(token: string): Promise<AdminJwtPayload> {
  const key = getSecretKey();
  const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
  const sub = payload.sub;
  const email = payload.email;
  if (typeof sub !== "string" || typeof email !== "string") {
    throw new Error("Invalid session token");
  }
  return { sub, email };
}
