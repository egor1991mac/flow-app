import { spawnSync } from "node:child_process";
import type { ImagePort } from "../ports.ts";

export let lastImageError = "";

function sharp(args: string[]): number {
  const r = spawnSync("bunx", ["sharp-cli", ...args], { encoding: "utf8" });
  if (process.env.FLOW_DEBUG && r.status !== 0) {
    process.stderr.write(`bunx sharp-cli ${args.join(" ")} -> ${r.status}: ${r.stderr ?? ""}\n`);
  }
  lastImageError = r.status === 0 ? "" : (r.stderr ?? "").trim() || (r.stdout ?? "").trim();
  return r.status ?? 1;
}

export const imageAdapter: ImagePort = {
  convert(input, output, quality = 80) {
    return sharp(["-i", input, "-o", output, "-f", "webp", "-q", String(quality)]) === 0;
  },
  get lastError() {
    return lastImageError;
  },
};
