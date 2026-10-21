import { createHmac } from "node:crypto";
export const rateBucket = (ip: string, secret: string, now = Date.now()) =>
  createHmac("sha256", secret)
    .update(`${Math.floor(now / 3600000)}:${ip}`)
    .digest("hex");
export function csvCell(value: unknown) {
  const text = String(value ?? "");
  return (
    '"' +
    (/^[\s]*[=+@\-\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""') +
    '"'
  );
}
export function aggregateCSV(data: any) {
  const rows: unknown[][] = [["السؤال", "الإجابة", "العدد"]];
  for (const [id, bars] of Object.entries(data.distributions ?? {}))
    for (const b of bars as any[]) rows.push([id, b.label, b.count]);
  return "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
export async function verifyBot(
  token: string,
  secret: string,
  hostname: string,
  fetcher: typeof fetch = fetch,
) {
  try {
    const r = await fetcher(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: new URLSearchParams({ secret, response: token }),
        signal: AbortSignal.timeout(8000),
      },
    );
    const b = (await r.json()) as any;
    return (
      r.ok &&
      b.success === true &&
      b.hostname === hostname &&
      b.action === "survey"
    );
  } catch {
    return false;
  }
}
