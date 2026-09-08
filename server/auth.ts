import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

export function createSessionManager(
  password: string,
  secret: string,
  now = () => Date.now(),
) {
  const key = createHmac("sha256", secret || password)
    .update(`crumb-owner:${password}`)
    .digest();
  return {
    matches(provided: string) {
      return timingSafeEqual(
        createHash("sha256").update(provided).digest(),
        createHash("sha256").update(password).digest(),
      );
    },
    async issue() {
      const issued = Math.floor(now() / 1000);
      return new SignJWT({ role: "owner" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(issued)
        .setExpirationTime(issued + 86400)
        .setIssuer("crumb")
        .setAudience("crumb-owner")
        .setSubject("owner")
        .setJti(randomUUID())
        .sign(key);
    },
    async verify(token: string) {
      try {
        const { payload } = await jwtVerify(token, key, {
          algorithms: ["HS256"],
          issuer: "crumb",
          audience: "crumb-owner",
          currentDate: new Date(now()),
          requiredClaims: ["exp", "iat", "sub", "jti"],
        });
        return payload.sub === "owner" && payload.role === "owner";
      } catch {
        return false;
      }
    },
  };
}
