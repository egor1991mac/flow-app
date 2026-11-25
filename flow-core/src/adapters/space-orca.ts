import { spawnSync } from "node:child_process";
import type { SpacePort } from "../ports.ts";

export function orcaAvailable(): boolean {
  if (process.env.ORCA_FLOW_SKIP_ORCA === "1") return false;
  return spawnSync("bash", ["-c", "command -v orca"], { encoding: "utf8" }).status === 0;
}

function orca(args: string[]): boolean {
  const r = spawnSync("orca", [...args, "--json"], { encoding: "utf8" });
  if (r.status !== 0) return false;
  try {
    return JSON.parse(r.stdout).ok === true;
  } catch {
    return false;
  }
}

export const orcaSpace: SpacePort = {
  available: orcaAvailable,
  registerFolder(path) {
    return orca(["repo", "add", "--path", path, "--kind", "folder"]);
  },
  registerWorktree(path, projectId) {
    return orca(["project", "setup-existing-folder", "--project", projectId, "--host", "local", "--path", path, "--kind", "git"]);
  },
  setWorktree(path, parent, display, comment) {
    const args = ["worktree", "set", "--worktree", `path:${path}`];
    if (parent) args.push("--parent-worktree", `path:${parent}`);
    else args.push("--no-parent");
    args.push("--display-name", display, "--comment", comment);
    return orca(args);
  },
  createTerminal(path, title, command) {
    return orca(["terminal", "create", "--worktree", `path:${path}`, "--title", title, "--command", command]);
  },
  createTab(path, url) {
    return orca(["tab", "create", "--url", url, "--worktree", `path:${path}`]);
  },
  launchAgent(path, prompt) {
    return orca(["agent", "launch", "--agent", "opencode", "--surface", "chat", "--worktree", `path:${path}`, "--prompt", prompt]);
  },
  hideRepo(path) {
    return orca(["repo", "hide", "--repo", `path:${path}`]);
  },
  closeTerminals(path) {
    orca(["terminal", "close", "--worktree", `path:${path}`, "--all"]);
  },
  closeTabs(path) {
    const r = spawnSync("orca", ["tab", "list", "--worktree", `path:${path}`, "--json"], { encoding: "utf8" });
    try {
      for (const t of JSON.parse(r.stdout).result?.tabs ?? []) {
        orca(["tab", "close", "--index", String(t.index), "--worktree", `path:${path}`]);
      }
    } catch {
      return;
    }
  },
};

export const noopSpace: SpacePort = {
  available: () => false,
  registerFolder: () => true,
  registerWorktree: () => true,
  setWorktree: () => true,
  createTerminal: () => true,
  createTab: () => true,
  launchAgent: () => true,
  hideRepo: () => true,
  closeTerminals: () => {},
  closeTabs: () => {},
};
