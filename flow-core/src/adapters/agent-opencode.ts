import { spawnSync } from "node:child_process";
import type { AgentPort } from "../ports.ts";

export interface LaunchOpts {
  agent?: string;
  title?: string;
  sessionId?: string;
  model?: string;
}

export function launchOpencode(workdir: string, prompt: string, opts: LaunchOpts = {}): boolean {
  const args = ["run", "--format", "json"];
  if (opts.agent) args.push("--agent", opts.agent);
  if (opts.title) args.push("--title", opts.title);
  if (opts.model) args.push("--model", opts.model);
  if (opts.sessionId) args.push("--session", opts.sessionId);
  args.push(prompt, workdir);
  const r = spawnSync("opencode", args, { encoding: "utf8" });
  return r.status === 0;
}

export function hasActiveAgent(workdir: string, titlePrefix: string): boolean {
  const r = spawnSync("opencode", ["session", "list", "--format", "json"], { cwd: workdir, encoding: "utf8" });
  if (r.status !== 0) return false;
  try {
    const sessions = JSON.parse(r.stdout);
    const list = Array.isArray(sessions) ? sessions : (sessions.sessions ?? []);
    return list.some((s: any) => typeof s.title === "string" && s.title.startsWith(titlePrefix) && !s.archived);
  } catch {
    return false;
  }
}

export const opencodeAgent: AgentPort = {
  launchChat(workdir, prompt) {
    return launchOpencode(workdir, prompt, { agent: "orca-task" });
  },
  hasActiveAgent(workdir) {
    return hasActiveAgent(workdir, "");
  },
};
