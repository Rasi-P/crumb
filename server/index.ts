import express from "express";
import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";
import { ZodError } from "zod";
import { loadState, saveState } from "./database";
import { applyCommand, commandSchema } from "../src/domain/commands";

const app = express();
const server = createServer(app);
const sessions = new Map<string, number>();
const password = process.env.OWNER_PASSWORD;
const production = process.env.NODE_ENV === "production";
if (production && !password)
  throw new Error("Set OWNER_PASSWORD before running in production.");
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  if (req.path.startsWith("/api")) res.setHeader("Cache-Control", "no-store");
  if (
    ["POST", "PUT", "DELETE", "PATCH"].includes(req.method) &&
    req.headers.origin &&
    new URL(req.headers.origin).host !== req.headers.host
  ) {
    res.status(403).json({ error: "This request is from a different origin." });
    return;
  }
  next();
});
const authenticated = (req: express.Request) =>
  !password ||
  (sessions.get(
    req.headers.cookie?.match(/crumb_session=([^;]+)/)?.[1] || "",
  ) || 0) > Date.now();
const attempts = new Map<string, { count: number; until: number }>();
app.get("/api/session", (req, res) =>
  res.json({ authenticated: authenticated(req), local: !password }),
);
app.post("/api/login", (req, res) => {
  const key = req.ip || "local";
  const attempt = attempts.get(key);
  if (attempt && attempt.until > Date.now() && attempt.count >= 10) {
    res
      .status(429)
      .json({ error: "Too many attempts. Please try again in 15 minutes." });
    return;
  }
  const provided = Buffer.from(String(req.body.password || ""));
  const expected = Buffer.from(password || "");
  if (
    password &&
    (provided.length !== expected.length ||
      !timingSafeEqual(provided, expected))
  ) {
    attempts.set(key, {
      count: attempt && attempt.until > Date.now() ? attempt.count + 1 : 1,
      until: Date.now() + 900000,
    });
    res
      .status(401)
      .json({ error: "That password does not match. Please try again." });
    return;
  }
  const token = randomBytes(32).toString("hex");
  for (const [key, expiry] of sessions)
    if (expiry < Date.now()) sessions.delete(key);
  sessions.set(token, Date.now() + 86400000);
  res.setHeader(
    "Set-Cookie",
    `crumb_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${production ? "; Secure" : ""}`,
  );
  res.json({ ok: true });
});
app.get("/api/quotes/:token", (req, res) => {
  const s = loadState();
  const q = s.quotes.find((q) => q.token === req.params.token);
  if (!q) {
    res.status(404).json({
      error: "This quotation is not available. Please contact the bakery.",
    });
    return;
  }
  const customer = s.customers.find((c) => c.id === q.customerId);
  res.json({
    quote: q,
    business: {
      name: s.business.name,
      phone: s.business.phone,
      email: s.business.email,
      terms: s.business.terms,
      address: s.business.address,
      logo: s.business.logo,
    },
    customer: { name: customer?.name },
    image: s.designs.find((d) => d.id === q.designId)?.image ?? 0,
  });
});
app.post("/api/quotes/:token/respond", (req, res, next) => {
  try {
    const command = commandSchema.parse({
      type: "quote.respond",
      token: req.params.token,
      status: req.body.status,
      request: req.body.request || "",
    });
    const s = applyCommand(loadState(), command);
    saveState(s);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
app.use("/api", (req, res, next) => {
  if (!authenticated(req)) {
    res.status(401).json({ error: "Please sign in to your bakery workspace." });
    return;
  }
  next();
});
app.get("/api/state", (_req, res) => res.json(loadState()));
app.post("/api/command", (req, res, next) => {
  try {
    const s = loadState();
    if (req.body.revision !== s.revision) {
      res.status(409).json({
        error: "Your workspace has a newer update. Please retry your change.",
        state: s,
      });
      return;
    }
    const nextState = applyCommand(s, commandSchema.parse(req.body.command));
    saveState(nextState);
    res.json(nextState);
  } catch (error) {
    next(error);
  }
});
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "This API endpoint does not exist." }),
);
app.use(
  (
    error: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    res.status(400).json({
      error:
        error instanceof ZodError
          ? error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ")
          : error.message,
    });
  },
);
if (production) {
  app.use(express.static(resolve("dist")));
  app.use((_req, res) => res.sendFile(resolve("dist/index.html")));
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: { server } },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const requestedPort = Number(process.env.PORT || 5173);
function listen(port: number) {
  server.once("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") listen(port + 1);
    else throw error;
  });
  server.listen(port, process.env.HOST || "127.0.0.1", () =>
    console.log(`Crumb is ready at http://localhost:${port}`),
  );
}
listen(requestedPort);
