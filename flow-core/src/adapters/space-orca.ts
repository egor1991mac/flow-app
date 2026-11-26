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

function orcaError(stdout: string, stderr: string): string {
  const text = stdout.trim() || stderr.trim();
  try {
    const data = JSON.parse(text);
    const error = data?.error;
    if (typeof error === "string") return error;
    if (error && typeof error.message === "string") return error.message;
    if (typeof data?.message === "string") return data.message;
  } catch {
    return text.slice(0, 300) || "orca: нет ответа";
  }
  return text.slice(0, 300) || "orca: нет ответа";
}

function worktreeSelector(path: string): string {
  const r = spawnSync("orca", ["repo", "show", "--repo", `path:${path}`, "--json"], {
    encoding: "utf8",
    timeout: 15000,
  });
  if (r.status === 0) {
    try {
      const id = JSON.parse(r.stdout)?.result?.repo?.id;
      if (typeof id === "string" && id) return `id:${id}::${path}`;
    } catch {
      return `path:${path}`;
    }
  }
  return `path:${path}`;
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
  listAgents(path) {
    const r = spawnSync("orca", ["agent", "list", "--worktree", `path:${path}`, "--json"], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      timeout: 20000,
    });
    if (r.status !== 0) return [];
    try {
      const list = JSON.parse(r.stdout)?.result?.agents;
      if (!Array.isArray(list)) return [];
      return list.map((a: { title?: unknown; state?: unknown }) => ({
        title: String(a?.title ?? ""),
        state: String(a?.state ?? ""),
      }));
    } catch {
      return [];
    }
  },
  launchAgentResult(path, prompt) {
    const r = spawnSync(
      "orca",
      [
        "agent",
        "launch",
        "--agent",
        "opencode",
        "--surface",
        "chat",
        "--worktree",
        worktreeSelector(path),
        "--prompt",
        prompt,
        "--focus",
        "--json",
      ],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 30000 }
    );
    if (r.status !== 0) return { ok: false, error: orcaError(r.stdout ?? "", r.stderr ?? "") };
    try {
      const data = JSON.parse(r.stdout);
      if (data?.ok === true) return { ok: true };
      return { ok: false, error: orcaError(r.stdout, r.stderr ?? "") };
    } catch {
      return { ok: false, error: orcaError(r.stdout ?? "", r.stderr ?? "") };
    }
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
  launchAgentResult: () => ({ ok: false, error: "Orca недоступна" }),
  hideRepo: () => true,
  closeTerminals: () => {},
  closeTabs: () => {},
};
