import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { parseEnv } from "node:util";
import { execFileSync } from "node:child_process";

const path = ".env.deployment.local";
if (!existsSync(path)) {
  writeFileSync(
    path,
    `OWNER_PASSWORD=${randomBytes(24).toString("base64url")}\nSESSION_SECRET=${randomBytes(48).toString("base64url")}\n`,
    { mode: 0o600 },
  );
}
chmodSync(path, 0o600);
const secrets = parseEnv(readFileSync(path, "utf8"));
for (const name of ["OWNER_PASSWORD", "SESSION_SECRET"]) {
  if (!secrets[name]) throw new Error(`Missing ${name} in ${path}`);
  try {
    execFileSync(
      "npx",
      [
        "--yes",
        "vercel@latest",
        "env",
        "add",
        name,
        "production",
        "--sensitive",
        "--scope",
        "rasikkaas-projects",
      ],
      {
        input: secrets[name],
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 120000,
      },
    );
    console.log(`${name} configured in Vercel production.`);
  } catch {
    throw new Error(
      `Could not configure ${name}. Check Vercel environment settings; existing values are not overwritten.`,
    );
  }
}
console.log(
  `Owner credentials are stored privately in ${path}. No secrets were printed.`,
);
