import { createServer } from "node:http";
import { resolve } from "node:path";
import express from "express";
import { createApp } from "./app";

const app = createApp();
const server = createServer(app);
if (process.env.NODE_ENV === "production") {
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
function listen(port: number) {
  server.once("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") listen(port + 1);
    else throw error;
  });
  server.listen(port, process.env.HOST || "127.0.0.1", () =>
    console.log(`Crumb is ready at http://localhost:${port}`),
  );
}
listen(Number(process.env.PORT || 5173));
