import { createApp } from "./app";

// Build input only. Vercel executes the bundled handler in .vercel/output,
// never this TypeScript source and never the local app.listen() entrypoint.
export default createApp();
