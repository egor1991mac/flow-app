import { spawnSync } from "node:child_process";
import type { GitPort } from "../ports.ts";

function git(args: string[]): { status: number; stdout: string } {
  const r = spawnSync("git", args, { encoding: "utf8" });
  if (process.env.FLOW_DEBUG && r.status !== 0) process.stderr.write(`git ${args.join(" ")} -> ${r.status}: ${r.stderr ?? ""}\n`);
  if (r.status !== 0) lastGitError = (r.stderr ?? "").trim();
  return { status: r.status ?? 1, stdout: (r.stdout ?? "").replace(/\n$/, "") };
}

export let lastGitError = "";

export const gitAdapter: GitPort = {
  fetchBase(donor, base) {
    const local = base.replace(/^origin\//, "");
    return git(["-C", donor, "fetch", "--quiet", "origin", `${local}:${base}`]).status === 0;
  },
  worktreeAdd(donor, branch, path, start, createBranch) {
    const args = ["-C", donor, "worktree", "add"];
    if (createBranch) args.push("-b", branch);
    args.push(path, start);
    return git(args).status === 0;
  },
  worktreeRemove(donor, path, force) {
    const args = ["-C", donor, "worktree", "remove"];
    if (force) args.push("--force");
    args.push(path);
    return git(args).status === 0;
  },
  branchDelete(donor, branch) {
    return git(["-C", donor, "branch", "-D", branch]).status === 0;
  },
  unsetUpstream(path) {
    git(["-C", path, "branch", "--unset-upstream"]);
  },
  statusPorcelain(path) {
    return git(["-C", path, "status", "--porcelain"]).stdout.split("\n").filter(Boolean);
  },
  merge(path, branch, message) {
    return git(["-C", path, "merge", "--no-ff", branch, "-m", message]).status === 0;
  },
  mergeAbort(path) {
    git(["-C", path, "merge", "--abort"]);
  },
  logOneline(path) {
    return git(["-C", path, "log", "-1", "--oneline"]).stdout;
  },
  isAncestor(path, branch, target) {
    return git(["-C", path, "merge-base", "--is-ancestor", branch, target]).status === 0;
  },
  revParseVerify(path, ref) {
    return git(["-C", path, "rev-parse", "--verify", "--quiet", ref]).status === 0;
  },
  forEachRef(path, pattern) {
    return git(["-C", path, "for-each-ref", "--format=%(refname:short)", pattern]).stdout.split("\n").filter(Boolean);
  },
  searchRefs(path, part) {
    const needle = part.trim().toLowerCase();
    const refs = git(["-C", path, "for-each-ref", "--format=%(refname:short)", "refs/heads/*", "refs/remotes/origin/*"])
      .stdout.split("\n")
      .filter(Boolean);
    if (!needle) return refs;
    return refs.filter((ref) => ref.toLowerCase().includes(needle));
  },
  diffNames(path, from, to) {
    return git(["-C", path, "diff", "--name-only", from, to]).stdout.split("\n").filter(Boolean);
  },
  addAll(path) {
    git(["-C", path, "add", "-A"]);
  },
  resetFile(path, file) {
    git(["-C", path, "reset", "-q", "--", file]);
  },
  commit(path, message) {
    return git(["-C", path, "commit", "-q", "-m", message]).status === 0;
  },
  checkout(path, ref) {
    const r = git(["-C", path, "checkout", ref]);
    if (r.status !== 0) {
      const fromOrigin = git(["-C", path, "checkout", "-b", ref, `origin/${ref}`]);
      return fromOrigin.status === 0;
    }
    return true;
  },
  checkoutNew(path, branch, base) {
    lastGitError = "";
    const dirty = git(["-C", path, "status", "--porcelain"]).stdout.split("\n").filter(Boolean);
    if (dirty.length > 0) {
      lastGitError = `в рабочей копии есть незакоммиченные изменения (${dirty.length}): ${dirty.slice(0, 5).join("; ")}`;
      return false;
    }
    if (git(["-C", path, "checkout", branch]).status === 0) return true;
    const hasBase = git(["-C", path, "rev-parse", "--verify", "--quiet", `origin/${base}`]).status === 0 ||
      git(["-C", path, "rev-parse", "--verify", "--quiet", base]).status === 0;
    if (!hasBase) {
      lastGitError = `основы ${base} нет в репозитории (сделай git fetch)`;
      return false;
    }
    if (git(["-C", path, "checkout", "-b", branch, `origin/${base}`]).status === 0) return true;
    return git(["-C", path, "checkout", "-b", branch, base]).status === 0;
  },
  remoteUrl(path) {
    const r = git(["-C", path, "remote", "get-url", "origin"]);
    return r.status === 0 ? r.stdout : null;
  },
  fetchFrom(path, source, ref) {
    return git(["-C", path, "fetch", "--quiet", source, `${ref}:${ref}`]).status === 0;
  },
  branchCreatedFrom(path, branch) {
    const r = git(["-C", path, "reflog", "show", branch, "--format=%gs"]);
    if (r.status !== 0) return null;
    const line = r.stdout.split("\n").find((l) => l.startsWith("branch: Created from"));
    return line ? line.replace("branch: Created from ", "").trim() : null;
  },
  get lastError() {
    return lastGitError;
  },
};
