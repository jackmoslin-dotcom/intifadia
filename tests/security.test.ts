import { it, expect, vi } from "vitest";
import {
  rateBucket,
  csvCell,
  aggregateCSV,
  verifyBot,
} from "../server/security";
it("rate identifiers are keyed and rotate hourly without storing raw IPs", () => {
  const a = rateBucket("127.0.0.1", "test", 0);
  expect(a).toHaveLength(64);
  expect(a).toBe(rateBucket("127.0.0.1", "test", 100));
  expect(a).not.toBe(rateBucket("127.0.0.1", "other", 0));
  expect(a).not.toBe(rateBucket("127.0.0.1", "test", 3600000));
  expect(a).not.toContain("127.0.0.1");
});
it("CSV neutralizes spreadsheet formulas and escapes quotes/newlines", () => {
  for (const s of ['=HYPERLINK("bad")', " +SUM(1)", "-1", "@SUM(1)", "\t=1"])
    expect(csvCell(s)).toMatch(/^"'/);
  expect(csvCell('a"b\nc')).toBe('"a""b\nc"');
  expect(
    aggregateCSV({ distributions: { city: [{ label: "طرابلس", count: 5 }] } }),
  ).toContain('"5"');
  expect(aggregateCSV({ distributions: {} })).not.toContain("undefined");
});
it("bot verification requires success, matching hostname and action; fails closed", async () => {
  const fake = (body: unknown) =>
    vi.fn(
      async () => new Response(JSON.stringify(body), { status: 200 }),
    ) as unknown as typeof fetch;
  expect(
    await verifyBot(
      "t",
      "s",
      "localhost",
      fake({ success: true, hostname: "localhost", action: "survey" }),
    ),
  ).toBe(true);
  for (const b of [
    { success: false },
    { success: true, hostname: "evil", action: "survey" },
    { success: true, hostname: "localhost", action: "other" },
  ])
    expect(await verifyBot("t", "s", "localhost", fake(b))).toBe(false);
  expect(
    await verifyBot(
      "t",
      "s",
      "localhost",
      vi.fn(async () => {
        throw Error("offline");
      }) as unknown as typeof fetch,
    ),
  ).toBe(false);
});
