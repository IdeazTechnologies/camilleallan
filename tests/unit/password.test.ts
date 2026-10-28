import { hashAuthCode } from "@/lib/auth-code";
import { hashDeviceToken, isDeviceToken } from "@/lib/device-token";
import { hashPassword, verifyPassword } from "@/lib/password";
import { describe, expect, it } from "vitest";

describe("passwords", () => {
  it("accepts the password that was hashed and rejects others", async () => {
    const stored = await hashPassword("correct horse");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse", stored)).toBe(true);
    expect(await verifyPassword("wrong horse", stored)).toBe(false);
    expect(await verifyPassword("correct horse", "not-a-hash")).toBe(false);
    expect(await verifyPassword("correct horse", `${stored}x`)).toBe(false);
  });
});

describe("auth codes and device tokens", () => {
  it("hashes a code with the purpose and email", () => {
    process.env.AUTH_SECRET = "unit-test-secret";
    const a = hashAuthCode("login", "ada@example.com", "123456");
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(hashAuthCode("login", "ada@example.com", "123456")).toBe(a);
    expect(hashAuthCode("reset", "ada@example.com", "123456")).not.toBe(a);
    expect(hashAuthCode("login", "ada@example.com", "123457")).not.toBe(a);
  });

  it("recognizes a device token and hashes it", () => {
    const token = "a".repeat(64);
    expect(isDeviceToken(token)).toBe(true);
    expect(isDeviceToken("short")).toBe(false);
    expect(isDeviceToken(`${token}ff`)).toBe(false);
    expect(hashDeviceToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashDeviceToken(token)).not.toBe(token);
  });
});
