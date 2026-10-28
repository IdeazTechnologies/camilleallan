import { createHash } from "node:crypto";

/** Peppered hash of a 6-digit code. The raw code is only in the email. */
export function hashAuthCode(purpose: string, email: string, code: string) {
  return createHash("sha256")
    .update(`${process.env.AUTH_SECRET ?? ""}\n${purpose}\n${email}\n${code}`)
    .digest("hex");
}
