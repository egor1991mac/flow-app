import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { readConfig, readRegistry } from "../../../flow-core/src/store.ts";
import { META, taskBranches } from "./flow-api.ts";

export interface CommitRow {
  hash: string;
  subject: string;
  author: string;
  date: string;
}

export interface MrRow {
  iid: string;
  title: string;
  state: string;
  url: string | null;
  sourceBranch: string;
  targetBranch: string;
}

export interface RepoGitRow {
  repo: string;
  branch: string;
  base: string | null;
  dir: string | null;
  commits: CommitRow[];
  mrs: MrRow[];
}

const SEP = "\u001f";

function str(value: unknown): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

function git(dir: string, args: string[]): string | null {
  const r = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
  return r.status === 0 ? (r.stdout ?? "") : null;
}

function commitRange(dir: string, branch: string, base: string | null): string | null {
  const exists = (ref: string) => git(dir, ["rev-parse", "--verify", "--quiet", ref]) !== null;
  if (base) {
    for (const ref of [base, `origin/${base}`]) {
      if (exists(ref)) return `${ref}..${branch}`;
    }
  }
  return exists(branch) ? branch : null;
}

function commits(dir: string, branch: string, base: string | null): CommitRow[] {
  const range = commitRange(dir, branch, base);
  if (!range) return [];
  const args = ["log", "--date=short", `--format=%h${SEP}%s${SEP}%an${SEP}%ad`, "-n", "50", range];
  const out = git(dir, args);
  if (!out) return [];
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash, subject, author, date] = line.split(SEP);
      return { hash: str(hash), subject: str(subject), author: str(author), date: str(date) };
    });
}

function mrs(dir: string, branch: string): MrRow[] {
  const r = spawnSync(
    "glab",
    ["mr", "list", "--source-branch", branch, "--all", "--per-page", "20", "-F", "json"],
    { cwd: dir, encoding: "utf8", timeout: 8000 }
  );
  if (r.status !== 0 || !r.stdout) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(r.stdout);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((item) => {
    const row: Record<string, unknown> = item && typeof item === "object" ? item : {};
    const url = str(row.web_url);
    return {
      iid: str(row.iid),
      title: str(row.title),
      state: str(row.state),
      url: url || null,
      sourceBranch: str(row.source_branch),
      targetBranch: str(row.target_branch),
    };
  });
}

export function taskGit(taskId: string): RepoGitRow[] {
  const task = readRegistry(META).tasks[taskId] ?? null;
  if (!task) return [];
  const config = readConfig(META);
  const branches = taskBranches(task);
  return task.repos.map((repo) => {
    const local = path.join(task.workspacePath, repo);
    const clone = path.join(config.mainRoot, repo);
    const dir = fs.existsSync(local) ? local : fs.existsSync(clone) ? clone : null;
    const row = branches.find((b) => b.repo === repo);
    const branch = row?.branch ?? task.branch;
    const base = row?.base ?? null;
    return {
      repo,
      branch,
      base,
      dir,
      commits: dir ? commits(dir, branch, base) : [],
      mrs: dir ? mrs(dir, branch) : [],
    };
  });
}
