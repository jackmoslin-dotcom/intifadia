import "node:process";
import { existsSync } from "node:fs";
import express from "express";
import { resolve } from "node:path";
import { createApp } from "./app";
if (existsSync(".env")) process.loadEnvFile(".env");
const app = createApp();
if (process.env.NODE_ENV === "production") {
  app.use(express.static(resolve("dist")));
  app.get("/{*path}", (_req, res) => res.sendFile(resolve("dist/index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
app.listen(Number(process.env.PORT || 4317), "127.0.0.1", () =>
  console.log(`Local: http://127.0.0.1:${process.env.PORT || 4317}`),
);
