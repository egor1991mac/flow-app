import type { Config } from "./types.ts";

const BFF_PATCH_FILE = "src/create-app-server.ts";
const BFF_PATCH_MARKER = "HTTPS_CERT_PATH";

export function taskDirtyFiles(porcelain: string[], bffFileContent: string | null): string[] {
  const hasPatch = bffFileContent !== null && bffFileContent.includes(BFF_PATCH_MARKER);
  return porcelain
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.length > 0)
    .filter((l) => !(hasPatch && l.endsWith(` ${BFF_PATCH_FILE}`)));
}

export function featureDirty(filesByRepo: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [repo, files] of Object.entries(filesByRepo)) {
    if (files.length > 0) out[repo] = files;
  }
  return out;
}

export type FeatureCleanDecision = { action: "proceed" | "wip" | "error"; message?: string };

export function featureCleanDecision(opts: { dirty: boolean; wipFlag: boolean; tty: boolean; userSaysYes: boolean; parent: string; path: string }): FeatureCleanDecision {
  if (!opts.dirty) return { action: "proceed" };
  if (opts.wipFlag) return { action: "wip" };
  if (opts.tty && opts.userSaysYes) return { action: "wip" };
  return { action: "error", message: `feature ${opts.parent} is dirty, commit or stash it first: ${opts.path}` };
}

export function reposToAddToFeature(taskRepos: string[], featureRepos: string[]): string[] {
  const known = new Set(featureRepos);
  return taskRepos.filter((r) => !known.has(r));
}

export type WorktreeOp = { repo: string; branch: string; path: string; start: string; createBranch: boolean };

export function createPlan(repos: string[], branch: string, wsPath: string, startByRepo: Record<string, string>): WorktreeOp[] {
  return repos.map((repo) => ({ repo, branch, path: `${wsPath}/${repo}`, start: startByRepo[repo] ?? "", createBranch: true }));
}

export function featureAddPlan(reposToAdd: string[], featureBranch: string, featurePath: string, config: Config): WorktreeOp[] {
  return reposToAdd.map((repo) => ({
    repo,
    branch: featureBranch,
    path: `${featurePath}/${repo}`,
    start: config.repos[repo]?.baseBranch ?? "",
    createBranch: true,
  }));
}
