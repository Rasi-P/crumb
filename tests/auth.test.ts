import { describe, expect, it } from "vitest";
import { createSessionManager } from "../server/auth";
import { createApp } from "../server/app";

const password = "test-password-not-used-in-production";
const secret = "test-secret-not-used-in-production-123456";
describe("serverless owner sessions", () => {
  it("validates a session in a separate application instance", async () => {
    const first = createSessionManager(password, secret);
    const second = createSessionManager(password, secret);
    expect(await second.verify(await first.issue())).toBe(true);
  });
  it("rejects a tampered session", async () => {
    const manager = createSessionManager(password, secret);
    const token = await manager.issue();
    const [header, payload, signature] = token.split(".");
    const changed = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
    expect(await manager.verify(`${header}.${payload}.${changed}`)).toBe(false);
  });
  it("expires a session after 24 hours", async () => {
    const issued = Date.now();
    const first = createSessionManager(password, secret, () => issued);
    const later = createSessionManager(
      password,
      secret,
      () => issued + 86400001,
    );
    expect(await later.verify(await first.issue())).toBe(false);
  });
  it("invalidates old sessions when the password changes", async () => {
    const first = createSessionManager(password, secret);
    expect(
      await createSessionManager("a-different-password", secret).verify(
        await first.issue(),
      ),
    ).toBe(false);
  });
  it("rejects empty and malformed session tokens", async () => {
    const manager = createSessionManager(password, secret);
    expect(await manager.verify("")).toBe(false);
    expect(await manager.verify("not-a-jwt")).toBe(false);
  });
  it("compares passwords without accepting prefixes or suffixes", () => {
    const manager = createSessionManager(password, secret);
    expect(manager.matches(password)).toBe(true);
    expect(manager.matches(`${password}extra`)).toBe(false);
    expect(manager.matches("")).toBe(false);
  });
  it("refuses production startup without strong authentication settings", () => {
    expect(() => createApp(undefined, { NODE_ENV: "production" })).toThrow(
      "OWNER_PASSWORD",
    );
    expect(() =>
      createApp(undefined, {
        NODE_ENV: "production",
        OWNER_PASSWORD: password,
      }),
    ).toThrow("SESSION_SECRET");
    expect(() =>
      createApp(undefined, {
        NODE_ENV: "production",
        OWNER_PASSWORD: password,
        SESSION_SECRET: secret,
        VERCEL: "1",
      }),
    ).toThrow("DATABASE_URL");
  });
});
