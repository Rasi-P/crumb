import express from "express";
import { createHash } from "node:crypto";
import { z, ZodError } from "zod";
import {
  applyCommand,
  commandSchema,
  type Command,
} from "../src/domain/commands";
import { getRepository } from "./storage";
import { StateConflict, type StateRepository } from "./storage/types";
import { createSessionManager } from "./auth";

class RequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function createApp(
  repository = getRepository,
  environment = process.env,
) {
  const app = express();
  const password = environment.OWNER_PASSWORD || "";
  const production = environment.NODE_ENV === "production";
  if (production && password.length < 16)
    throw new Error(
      "Set OWNER_PASSWORD to at least 16 characters before running in production.",
    );
  if (production && (environment.SESSION_SECRET?.length || 0) < 32)
    throw new Error(
      "Set SESSION_SECRET to at least 32 characters before running in production.",
    );
  if (environment.VERCEL && !environment.DATABASE_URL)
    throw new Error(
      "Connect Postgres and set DATABASE_URL before deploying to Vercel.",
    );
  const sessions = createSessionManager(
    password,
    environment.SESSION_SECRET || password,
  );
  const authenticated = async (req: express.Request) =>
    !password ||
    sessions.verify(
      req.headers.cookie?.match(/(?:^|;\s*)crumb_session=([^;]+)/)?.[1] || "",
    );
  const cookie = (value: string, age: number) =>
    `crumb_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${production ? "; Secure" : ""}`;
  async function execute(
    repo: StateRepository,
    command: Command,
    revision?: number,
  ) {
    return repo.mutate((state) => {
      try {
        return applyCommand(state, command);
      } catch (error) {
        throw new RequestError((error as Error).message);
      }
    }, revision);
  }
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    if (req.path.startsWith("/api")) res.setHeader("Cache-Control", "no-store");
    if (
      ["POST", "PUT", "DELETE", "PATCH"].includes(req.method) &&
      req.headers.origin
    ) {
      try {
        if (new URL(req.headers.origin).host !== req.headers.host)
          throw new Error();
      } catch {
        res
          .status(403)
          .json({ error: "This request is from a different origin." });
        return;
      }
    }
    next();
  });
  app.get("/api/session", async (req, res) => {
    res.json({ authenticated: await authenticated(req), local: !password });
  });
  app.post("/api/login", async (req, res) => {
    if (!password) {
      res.json({ ok: true });
      return;
    }
    const body = z.object({ password: z.string().max(200) }).parse(req.body);
    const forwarded = environment.VERCEL
      ? req.headers["x-forwarded-for"]
      : undefined;
    const address =
      typeof forwarded === "string"
        ? forwarded.split(",")[0].trim()
        : req.ip || "local";
    const key = createHash("sha256").update(address).digest("hex");
    if (!(await (await repository()).consumeLoginAttempt(key))) {
      res.setHeader("Retry-After", "900");
      res
        .status(429)
        .json({ error: "Too many attempts. Please try again in 15 minutes." });
      return;
    }
    if (!sessions.matches(body.password)) {
      res
        .status(401)
        .json({ error: "That password does not match. Please try again." });
      return;
    }
    res.setHeader("Set-Cookie", cookie(await sessions.issue(), 86400));
    res.json({ ok: true });
  });
  app.post("/api/logout", (_req, res) => {
    res.setHeader("Set-Cookie", cookie("", 0));
    res.json({ ok: true });
  });
  app.get("/api/quotes/:token", async (req, res) => {
    const state = await (await repository()).read();
    const quote = state.quotes.find((q) => q.token === req.params.token);
    if (!quote) {
      res.status(404).json({
        error: "This quotation is not available. Please contact the bakery.",
      });
      return;
    }
    res.json({
      quote,
      business: {
        name: state.business.name,
        phone: state.business.phone,
        email: state.business.email,
        terms: state.business.terms,
        address: state.business.address,
        logo: state.business.logo,
      },
      customer: {
        name: state.customers.find((c) => c.id === quote.customerId)?.name,
      },
      image: state.designs.find((d) => d.id === quote.designId)?.image ?? 0,
    });
  });
  app.post("/api/quotes/:token/respond", async (req, res) => {
    const command = commandSchema.parse({
      type: "quote.respond",
      token: req.params.token,
      status: req.body.status,
      request: req.body.request || "",
    });
    await execute(await repository(), command);
    res.json({ ok: true });
  });
  app.use("/api", async (req, res, next) => {
    if (!(await authenticated(req))) {
      res
        .status(401)
        .json({ error: "Please sign in to your bakery workspace." });
      return;
    }
    next();
  });
  app.get("/api/state", async (_req, res) =>
    res.json(await (await repository()).read()),
  );
  app.post("/api/command", async (req, res) => {
    const body = z
      .object({
        revision: z.number().int().nonnegative(),
        command: commandSchema,
      })
      .parse(req.body);
    res.json(await execute(await repository(), body.command, body.revision));
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
      if (error instanceof StateConflict) {
        res.status(409).json({ error: error.message, state: error.state });
        return;
      }
      if (error instanceof RequestError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      if (error instanceof ZodError) {
        res.status(400).json({
          error: error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        });
        return;
      }
      if ("type" in error && error.type === "entity.parse.failed") {
        res.status(400).json({
          error: "The request is not valid JSON. Please retry your action.",
        });
        return;
      }
      console.error(
        "Workspace request failed:",
        error.name,
        "code" in error ? error.code : "internal",
      );
      res.status(503).json({
        error:
          "The bakery database is temporarily unavailable. Please try again shortly.",
      });
    },
  );
  return app;
}
