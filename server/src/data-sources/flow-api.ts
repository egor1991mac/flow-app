import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runCli } from "../../../flow-core/src/cli.ts";
import type { CliDeps } from "../../../flow-core/src/cli.ts";
import {
  readRegistry,
  readConfig,
  stagesPath,
  globalStagesPath,
  readStages,
} from "../../../flow-core/src/store.ts";
import { branchName, cleanSummary } from "../../../flow-core/src/naming.ts";
import { repoWebUrl } from "../../../flow-core/src/docs.ts";
import { intakeId, typeKind } from "../../../flow-core/src/intake.ts";
import {
  issueField,
  issueAttribute,
  youtrackAdapter,
} from "../../../flow-core/src/adapters/youtrack.ts";
import { gitAdapter } from "../../../flow-core/src/adapters/git.ts";
import { dockerAdapter } from "../../../flow-core/src/adapters/docker.ts";
import { hostsAdapter } from "../../../flow-core/src/adapters/hosts.ts";
import { orcaSpace, noopSpace, orcaAvailable } from "../../../flow-core/src/adapters/space-orca.ts";
import { opencodeAgent } from "../../../flow-core/src/adapters/agent-opencode.ts";
import type { TaskType } from "../../../flow-core/src/types.ts";

export const HOME =
  process.env.FLOW_HOME ?? path.join(process.env.HOME ?? "", "orca/workspaces/all-projects");
export const META = path.join(HOME, ".orca-flow");
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const FLOW_BIN = path.join(ROOT, "flow-core/bin/flow.mjs");

export interface Job {
  log: string;
  done: boolean;
  code: number | null;
}

const jobs = new Map<string, Job>();

export function startJob(argv: string[]): string {
  const id = crypto.randomUUID();
  const job: Job = { log: "", done: false, code: null };
  jobs.set(id, job);
  const child = spawn(process.execPath, ["--experimental-strip-types", FLOW_BIN, ...argv], {
    env: { ...process.env, FLOW_HOME: HOME, FLOW_STREAM: "1" },
  });
  child.stdout.on("data", (d) => (job.log += d.toString()));
  child.stderr.on("data", (d) => (job.log += d.toString()));
  child.on("error", (e) => {
    job.log += `\n${String((e as Error).message ?? e)}\n`;
    job.done = true;
    job.code = 1;
  });
  child.on("close", (code) => {
    job.done = true;
    job.code = code;
  });
  return id;
}

export function getJob(id: string): Job | null {
  return jobs.get(id) ?? null;
}

export interface InvokeResult {
  ok: boolean;
  output: string[];
  error?: string;
  err?: string[];
}

export function invoke(argv: string[], extra: Partial<CliDeps> = {}): InvokeResult {
  const out: string[] = [];
  const err: string[] = [];
  const deps: CliDeps = {
    metaDir: META,
    git: gitAdapter,
    docker: dockerAdapter,
    youtrack: youtrackAdapter,
    hosts: hostsAdapter,
    space: orcaAvailable() ? orcaSpace : noopSpace,
    agent: opencodeAgent,
    out: (s) => out.push(s),
    err: (s) => err.push(s),
    ...extra,
  };
  try {
    runCli(argv, deps);
    return { ok: true, output: out };
  } catch (e) {
    return { ok: false, output: out, error: String((e as Error).message ?? e), err };
  }
}

export function tailJsonl<T>(file: string, n: number): T[] {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .slice(-n)
    .map((l) => JSON.parse(l) as T);
}

export interface BranchRow {
  repo: string;
  branch: string;
  url: string | null;
  base: string | null;
  baseUrl: string | null;
}

export function taskBranches(task: {
  repos: string[];
  branch: string;
  id: string;
  bases?: Record<string, string>;
}): BranchRow[] {
  const config = readConfig(META);
  return task.repos.map((repo) => {
    const clone = path.join(config.mainRoot, repo);
    const exists = fs.existsSync(clone);
    let branch = task.branch;
    if (exists && !gitAdapter.revParseVerify(clone, `refs/heads/${branch}`)) {
      const same = gitAdapter.forEachRef(clone, "refs/heads/*").filter((b) => b.includes(task.id));
      if (same.length === 1) branch = same[0];
    }
    const stored = task.bases?.[repo] ?? null;
    const created =
      stored || !exists
        ? null
        : gitAdapter.branchCreatedFrom(clone, branch) ??
          gitAdapter.branchCreatedFrom(clone, task.branch);
    const rawBase = stored ?? created;
    const base = rawBase && rawBase !== "HEAD" ? rawBase.replace(/^origin\//, "") : null;
    const web = exists ? repoWebUrl(gitAdapter.remoteUrl(clone)) : null;
    return {
      repo,
      branch,
      url: web ? `${web}/-/tree/${branch}` : null,
      base,
      baseUrl: web && base ? `${web}/-/tree/${base}` : null,
    };
  });
}

export function branchNames(parentId?: string | null): string[] {
  const config = readConfig(META);
  const names = new Set<string>();
  for (const repo of Object.keys(config.repos)) {
    const clone = path.join(config.mainRoot, repo);
    if (!fs.existsSync(clone)) continue;
    for (const ref of gitAdapter.searchRefs(clone, parentId ?? "")) {
      const name = ref.replace(/^origin\//, "");
      if (name !== "HEAD") names.add(name);
    }
  }
  const all = [...names];
  if (!parentId) return all.sort();
  const parentBranch = readRegistry(META).tasks[parentId]?.branch ?? null;
  return [...new Set([...all, "stage"])].sort(
    (a, b) => Number(b === parentBranch) - Number(a === parentBranch) || a.localeCompare(b)
  );
}

export interface CreateTaskInput {
  id: string;
  type: string;
  repos?: string | null;
  parentId?: string | null;
  summary?: string | null;
  description?: string | null;
  fromBranch?: string | null;
  fromBase?: boolean | null;
}

export interface CreateTaskResult extends InvokeResult {
  autoFeature?: string | null;
}

export function createTask(b: CreateTaskInput): CreateTaskResult {
  if (!b.repos || !String(b.repos).trim()) {
    return { ok: false, output: [], error: "выбери хотя бы один репозиторий" };
  }
  const tmpFiles: string[] = [];
  let parentId = b.parentId || null;
  let autoFeature: string | null = null;
  const regNow = readRegistry(META);
  const parentKnown = parentId ? regNow.tasks[parentId] : null;
  if (parentKnown && parentKnown.type !== "story") {
    return {
      ok: false,
      output: [],
      error: `${parentId} есть в реестре, но это ${parentKnown.type}, а не Фича`,
    };
  }
  const needFeature = b.type !== "story" && (!parentId || !parentKnown);
  const writeFixture = (obj: Record<string, unknown>) => {
    const f = path.join(META, `ui-fixture-${String(obj.id)}.json`);
    fs.writeFileSync(f, JSON.stringify(obj));
    tmpFiles.push(f);
    return f;
  };
  try {
    if (needFeature) {
      autoFeature = parentId || `${b.id}-feature`;
      const fSummary = parentId ? `Фича ${parentId}` : `Фича для ${b.id}`;
      const ffx = writeFixture({
        id: autoFeature,
        type: "story",
        titleRu: `${autoFeature}: ${fSummary}`,
        summary: fSummary,
        description: parentId
          ? `Фича ${autoFeature} поднята локально вместе с задачей ${b.id} (в реестре её не было).`
          : `Авто-Фича, создана вместе с задачей ${b.id}.`,
        branchName: branchName(autoFeature, "story", fSummary),
        parentId: null,
      });
      const featureRes = invoke([
        "new",
        autoFeature,
        "--type",
        "story",
        "--repos",
        b.repos,
        "--fixture",
        ffx,
      ]);
      if (!featureRes.ok) return featureRes;
      parentId = autoFeature;
    }
    const argv = ["new", b.id, "--type", b.type];
    if (b.repos) argv.push("--repos", b.repos);
    if (parentId) argv.push("--feature", parentId);
    if (b.fromBase) argv.push("--from-base");
    if (b.fromBranch) argv.push("--from-branch", b.fromBranch);
    if (b.summary !== undefined && b.summary !== null && String(b.summary).trim() !== "") {
      const fx = writeFixture({
        id: b.id,
        type: b.type,
        titleRu: `${b.id}: ${cleanSummary(b.summary)}`,
        summary: b.summary,
        description: b.description ?? "",
        branchName: branchName(b.id, b.type as TaskType, b.summary),
        parentId: b.type === "story" ? null : parentId,
      });
      argv.push("--fixture", fx);
    }
    return { ...invoke(argv), autoFeature };
  } finally {
    for (const f of tmpFiles) fs.rmSync(f, { force: true });
  }
}

export interface SwitchTaskInput {
  id: string;
  repos?: string | null;
  type?: string | null;
  summary?: string | null;
  description?: string | null;
  parentId?: string | null;
  from?: string | null;
}

export function switchTask(b: SwitchTaskInput): InvokeResult {
  if (!b.repos) return { ok: false, output: [], error: "выбери репозитории" };
  if (!b.id) return { ok: false, output: [], error: "укажи ID задачи" };
  const name = branchName(b.id, (b.type ?? "task") as TaskType, b.summary || b.id);
  return invoke([
    "switch",
    name,
    "--from",
    b.from || "stage",
    "--repos",
    b.repos,
    "--id",
    b.id,
    "--type",
    b.type ?? "task",
    "--summary",
    b.summary || b.id,
    "--description",
    b.description || "",
    ...(b.parentId ? ["--parent", b.parentId] : []),
  ]);
}

export interface IntakeResult {
  ok: boolean;
  id?: string | null;
  type?: string | null;
  ytType?: string | null;
  state?: string | null;
  summary?: string | null;
  description?: string | null;
  parentId?: string | null;
  parentError?: string | null;
  parentSource?: string | null;
  branchName?: string | null;
  titleRu?: string | null;
  error?: string | null;
}

export function intakePreview(input: string): IntakeResult {
  const id = intakeId(input);
  if (!id) return { ok: false, error: "не удалось разобрать ID из ссылки" };
  const issue = youtrackAdapter.issueView(id) as { idReadable?: string } | null;
  if (!issue || issue.idReadable !== id) {
    return {
      ok: false,
      error: `${id}: YouTrack недоступен или задача не найдена (проверь VPN/авторизацию)`,
    };
  }
  const parents = youtrackAdapter.issueParents(id);
  const links = youtrackAdapter.issueSubtaskLinks
    ? youtrackAdapter.issueSubtaskLinks(id)
    : { inward: parents, outward: [], relates: [] };
  const storiesOf = (ids: string[]) =>
    ids.filter((c) => {
      const ci = youtrackAdapter.issueView(c);
      return ci && typeKind(issueField(ci, "Type")) === "story";
    });
  const inwardStories = storiesOf(links.inward);
  const outwardStories = storiesOf(links.outward);
  const relatedStories = storiesOf(links.relates ?? []);
  let parentId: string | null = null;
  let parentError: string | null = null;
  let parentSource: string | null = null;
  const ownType = typeKind(issueField(issue, "Type")) ?? "task";
  if (ownType === "story") {
    parentId = null;
  } else if (inwardStories.length === 1) {
    parentId = inwardStories[0];
    parentSource = "Subtask";
  } else if (inwardStories.length > 1)
    parentError = `несколько Stories-родителей: ${inwardStories.join(", ")}`;
  else if (outwardStories.length === 1) {
    parentId = outwardStories[0];
    parentSource = "Subtask";
  } else if (outwardStories.length > 1)
    parentError = `несколько Stories-родителей: ${outwardStories.join(", ")}`;
  else if (relatedStories.length === 1) {
    parentId = relatedStories[0];
    parentSource = "Relates (проверь Фичу)";
  } else if (relatedStories.length > 1)
    parentError = `несколько Stories в Relates: ${relatedStories.join(", ")}`;
  else if (parents.length > 0)
    parentError = `родитель найден, но это не Story: ${parents.join(", ")}`;
  const summary = issueAttribute(issue, "summary");
  return {
    ok: true,
    id,
    type: typeKind(issueField(issue, "Type")) ?? "task",
    ytType: issueField(issue, "Type"),
    state: issueField(issue, "State"),
    summary,
    description: issueAttribute(issue, "description"),
    parentId,
    parentError,
    parentSource,
    branchName: branchName(id, typeKind(issueField(issue, "Type")) ?? "task", summary),
    titleRu: `${id}: ${cleanSummary(summary)}`,
  };
}

export { readRegistry, readConfig, stagesPath, globalStagesPath, readStages };
