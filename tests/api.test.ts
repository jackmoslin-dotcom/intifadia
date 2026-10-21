import { beforeAll, afterAll, it, expect } from "vitest";
import { createApp } from "../server/app";
import type { Server } from "node:http";
let server: Server;
let base: string;
beforeAll(async () => {
  server = createApp({ APP_ORIGIN: "http://localhost:3000" }).listen(
    0,
    "127.0.0.1",
  );
  await new Promise<void>((resolve) => server.on("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
it("unconfigured service explicitly fails closed without fabricated stats", async () => {
  const r = await fetch(base + "/api/results");
  expect(r.status).toBe(503);
  expect(await r.json()).toHaveProperty("error");
  expect(r.headers.get("cache-control")).toBe("no-store");
  expect(r.headers.get("x-content-type-options")).toBe("nosniff");
});
it("rejects cross-origin writes", async () => {
  const r = await fetch(base + "/api/submit", {
    method: "POST",
    headers: {
      Origin: "https://evil.example",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  expect(r.status).toBe(403);
});
it("rejects malformed and invalid requests", async () => {
  for (const body of [
    "{",
    JSON.stringify({
      requestId: crypto.randomUUID(),
      answers: { city: "evil" },
      consent: true,
      botToken: "test",
    }),
  ]) {
    const r = await fetch(base + "/api/submit", {
      method: "POST",
      headers: {
        Origin: "http://localhost:3000",
        "Content-Type": "application/json",
      },
      body,
    });
    expect(r.status).toBe(400);
  }
});
it("valid shape cannot bypass required external configuration", async () => {
  const r = await fetch(base + "/api/submit", {
    method: "POST",
    headers: {
      Origin: "http://localhost:3000",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requestId: crypto.randomUUID(),
      answers: {},
      consent: true,
      botToken: "test",
    }),
  });
  expect(r.status).toBe(503);
});
it("never exposes service keys via public config", async () => {
  const c = await (await fetch(base + "/api/config")).json();
  expect(c.configured).toBe(false);
  expect(c).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
  expect(c).not.toHaveProperty("RATE_LIMIT_SECRET");
});
