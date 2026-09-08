import { build } from "esbuild";

await build({
  entryPoints: ["server/vercel.ts"],
  outfile: ".server-build/app.mjs",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  packages: "external",
  define: { "process.env.VERCEL": '"1"' },
  minifySyntax: true,
  logLevel: "info",
});
