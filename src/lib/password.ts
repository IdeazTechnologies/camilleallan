import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const SCRYPT_N = 16384;
const SCRYPT_OPTIONS: ScryptOptions = { N: SCRYPT_N, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 32;

function scryptKey(password: string, salt: string, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 200;

/** scrypt hash, stored as `scrypt$<cost>$<salt>$<hash>`. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = await scryptKey(password, salt, SCRYPT_OPTIONS);
  return `scrypt$${SCRYPT_N}$${salt}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algo, cost, salt, hash] = stored.split("$");
  const n = Number(cost);
  if (algo !== "scrypt" || !salt || !hash || !Number.isInteger(n) || n < 2) return false;
  let actual: Buffer;
  try {
    actual = await scryptKey(password, salt, { ...SCRYPT_OPTIONS, N: n });
  } catch {
    return false;
  }
  const expected = Buffer.from(hash, "base64url");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(actual, expected);
}
