import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { GitPort, DockerPort, YouTrackPort, HostsPort, SpacePort, AgentPort } from "./ports.ts";
import type { Config, Registry, Task, TaskType, StagesFile } from "./types.ts";
import { readRegistry, readConfig, writeJsonAtomic, lock, unlock, stagesPath, globalStagesPath, readStages, initStages, writeStages, validateStages } from "./store.ts";
import { branchName, dockerProject, cleanSummary } from "./naming.ts";
import { resolveRepos } from "./repos.ts";
import { resolveStartPoint, normalizeRef, externalBaseUnresolved } from "./base.ts";
import { createPlan, featureAddPlan, reposToAddToFeature, taskDirtyFiles } from "./workspace.ts";
import { allocatePorts, writeEnv, renderCompose } from "./stack.ts";
import { mergePrecheck, finishGates, setStageStatus, approveStage } from "./gates.ts";
import { intakeId, parentDecision } from "./intake.ts";
import { writeSpec, writeAgents, repoWebUrl } from "./docs.ts";

export interface CliDeps {
  metaDir: string;
  git: GitPort;
  docker: DockerPort;
  youtrack: YouTrackPort;
  hosts: HostsPort;
  space: SpacePort;
  agent: AgentPort;
  out: (s: string) => void;
  err: (s: string) => void;
  startStack?: boolean;
  assumeYes?: boolean;
}

interface IntakePlan {
  id: string;
  type: TaskType;
  titleRu: string;
  summary: string;
  description: string;
  branchName: string;
  parentId: string | null;
}

function die(deps: CliDeps, msg: string): never {
  deps.err(`flow: ${msg}`);
  throw new Error(msg);
}

function parseFlags(argv: string[]): { pos: string[]; flags: Record<string, string | boolean> } {
  const pos: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else flags[key] = true;
    } else pos.push(a);
  }
  return { pos, flags };
}

function intake(deps: CliDeps, input: string, type: TaskType, fixture?: string): IntakePlan {
  if (fixture) {
    const plan = JSON.parse(fs.readFileSync(fixture, "utf8"));
    return plan as IntakePlan;
  }
  const id = intakeId(input);
  if (!id) die(deps, `cannot parse issue id: ${input}`);
  const issue: any = deps.youtrack.issueView(id);
  if (!issue || issue.idReadable !== id) die(deps, `issue not found: ${id}`);
  const parents = deps.youtrack.issueParents(id);
  const pd = parentDecision(parents);
  if ("error" in pd) die(deps, `${id} ${pd.error}`);
  const summary = issue.summary ?? "";
  const description = issue.description ?? "";
  return {
    id,
    type,
    titleRu: `${id}: ${cleanSummary(summary)}`,
    summary,
    description,
    branchName: branchName(id, type, summary),
    parentId: type === "story" ? null : pd.parentId,
  };
}

function cmdNew(deps: CliDeps, argv: string[]): void {
  const { pos, flags } = parseFlags(argv);
  const input = pos[0];
  const type = flags.type as TaskType;
  if (!input || !type) die(deps, "usage: flow new <id|url> --type story|task|bug [--repos list] [--fixture file] [--dry-run]");
  const config = readConfig(deps.metaDir);
  const registry = readRegistry(deps.metaDir);
  const plan = intake(deps, input, type, flags.fixture as string | undefined);
  let branch = plan.branchName;
  const reposInput = (flags.repos as string) ?? "";
  const repos = resolveRepos(reposInput, config);
  if (repos.length === 0) die(deps, "no repositories selected");

  const parent = flags["no-feature"] ? null : ((flags.feature as string) ?? plan.parentId);
  const feature = parent ? registry.tasks[parent] ?? null : null;
  const external = !!parent && !feature;

  const startByRepo: Record<string, string> = {};
  const attachRef = flags["attach-ref"] ? normalizeRef(flags["attach-ref"] as string) : null;
  if (attachRef) {
    for (const repo of repos) {
      const donor = path.join(config.donorsRoot, `${repo}.git`);
      const hasOrigin = deps.git.forEachRef(donor, "refs/remotes/origin/*").includes(`origin/${attachRef}`);
      const hasLocal = deps.git.forEachRef(donor, "refs/heads/*").includes(attachRef);
      if (!hasOrigin && !hasLocal) die(deps, `branch ${attachRef} is not in ${repo} (network/VPN?)`);
      startByRepo[repo] = hasOrigin ? `origin/${attachRef}` : attachRef;
    }
  } else {
    for (const repo of repos) {
      const donor = path.join(config.donorsRoot, `${repo}.git`);
      const originRefs = deps.git.forEachRef(donor, "refs/remotes/origin/*");
      const headRefs = deps.git.forEachRef(donor, "refs/heads/*");
      const decision = resolveStartPoint({
        repo,
        baseRef: flags["from-branch"] ? normalizeRef(flags["from-branch"] as string) : null,
        forceBase: !!flags["from-base"],
        featureBranch: feature ? feature.branch : null,
        external,
        parent,
        originRefs,
        headRefs,
        config,
      });
      if (decision.action === "error") die(deps, decision.message);
      startByRepo[repo] = decision.action === "explicit" ? (decision.ref ?? "") : decision.ref;
    }
  }
  if (attachRef) branch = attachRef;
  const ws = path.join(config.workspacesRoot, branch);

  deps.out(`plan: ${type} ${plan.id} branch=${branch}`);
  deps.out(`  ws=${ws}`);
  deps.out(`  repos=${repos.join(" ")} base=${JSON.stringify(startByRepo)}`);
  if (flags["dry-run"]) {
    deps.out("dry run: nothing created");
    return;
  }
  if (registry.tasks[plan.id] && registry.tasks[plan.id]!.status !== "closed") die(deps, `${plan.id} already exists`);
  if (fs.existsSync(ws)) die(deps, `orphan folder without a registry record: ${ws}`);

  lock(deps.metaDir);
  try {
    const created: string[] = [];
    fs.mkdirSync(ws, { recursive: true });
    for (const op of createPlan(repos, branch, ws, startByRepo)) {
      const donor = path.join(config.donorsRoot, `${op.repo}.git`);
      if (!deps.git.worktreeAdd(donor, op.branch, op.path, op.start, !attachRef)) {
        for (const r of created) {
          deps.git.worktreeRemove(path.join(config.donorsRoot, `${r}.git`), path.join(ws, r), true);
          deps.git.branchDelete(path.join(config.donorsRoot, `${r}.git`), branch);
        }
        die(deps, `cannot create worktrees for ${plan.id}`);
      }
      deps.git.unsetUpstream(op.path);
      created.push(op.repo);
    }
    const task: Task = {
      id: plan.id, type, parentId: parent, parentExternal: external, titleRu: plan.titleRu,
      description: plan.description, branch, workspacePath: ws, repos, activeRepos: repos,
      slot: null, dockerProject: dockerProject(branch), ports: {}, endpoints: {},
      status: "active", bases: startByRepo,
      createdAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"), children: [],
    };
    registry.tasks[plan.id] = task;
    if (parent && feature && feature.type === "story") {
      feature.children = [...new Set([...feature.children, plan.id])];
    }
    writeJsonAtomic(path.join(deps.metaDir, "state.json"), registry);
  } finally {
    unlock(deps.metaDir);
  }
  const task = registry.tasks[plan.id]!;
  writeSpec(ws, task);
  writeAgents(ws, task, feature);
  deps.space.registerFolder(ws);
  const passedStages = deps.space.available() ? [1, 2, 3, 4, 5] : [1, 2, 3, 5];
  recordStages(deps, plan.id, passedStages, "авто: выполнено pipeline (задача, база, копии, ТЗ)");
  deps.out(`created ${plan.id} (${type})`);
  deps.out(`next: flow up ${plan.id} --start (или кнопка «Старт» в UI)`);
}

function shareRepoEnv(ws: string, repo: string, config: Config, deps: CliDeps): void {
  const target = repo === "www" ? path.join(ws, "www/apps/main/.env") : path.join(ws, repo, ".env");
  if (fs.existsSync(target)) return;
  const source = repo === "www" ? path.join(config.mainRoot, "www/apps/main/.env") : path.join(config.mainRoot, repo, ".env");
  if (!fs.existsSync(source)) die(deps, `repo env file is missing: ${source}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.symlinkSync(source, target);
}

function applyBffPatch(ws: string, config: Config, deps: CliDeps): void {
  const bff = path.join(ws, "bff");
  const file = path.join(bff, "src/create-app-server.ts");
  if (!fs.existsSync(file)) return;
  if (fs.readFileSync(file, "utf8").includes("HTTPS_CERT_PATH")) return;
  const r = spawnSync("git", ["-C", bff, "apply", path.join(config.toolkitDir, "bff-https.patch")], { encoding: "utf8" });
  if (r.status !== 0) die(deps, `cannot apply bff-https.patch: ${(r.stderr ?? "").trim()}`);
}

function repoPath(config: Config, ws: string, repo: string): string | null {
  const local = path.join(ws, repo);
  if (fs.existsSync(local)) return local;
  const main = path.join(config.mainRoot, repo);
  return fs.existsSync(main) ? main : null;
}

function agentWorkdir(task: Task, config: Config): string {
  for (const repo of task.repos) {
    const dir = repoPath(config, task.workspacePath, repo);
    if (dir) return dir;
  }
  return task.workspacePath;
}

function branchLinks(deps: CliDeps, config: Config, repos: string[], ws: string, branch: string): string[] {
  const links: string[] = [];
  for (const repo of repos) {
    const dir = repoPath(config, ws, repo);
    const url = dir ? repoWebUrl(deps.git.remoteUrl(dir)) : null;
    if (url) links.push(`  ${repo}: ${url}/-/tree/${branch}`);
  }
  return links;
}

function agentPrompt(deps: CliDeps, task: Task, feature: Task | null): string {
  const config = readConfig(deps.metaDir);
  const ws = task.workspacePath;
  const repos = task.repos.map((r) => {
    const dir = repoPath(config, ws, r);
    return dir ? `${r} (${dir})` : r;
  });
  const lines = [
    `Ты в задаче ${task.id} (${task.type}): ${task.titleRu}`,
    `Задача: https://youtrack.realt.by/issue/${task.id}`,
    `Рабочая копия: ${ws}`,
    `Ветка задачи \`${task.branch}\`, репозитории: ${repos.join(", ")}`,
    ...branchLinks(deps, config, task.repos, ws, task.branch),
  ];
  if (task.parentId) {
    const bases = Object.values(task.bases ?? {}).filter(Boolean);
    const parentBranches = [...new Set([...(feature ? [feature.branch] : []), ...bases])];
    lines.push(feature ? `Фича ${feature.id}: ветка \`${feature.branch}\`, папка ${feature.workspacePath}` : `Фича ${task.parentId} вне реестра: https://youtrack.realt.by/issue/${task.parentId}`);
    for (const branch of parentBranches) {
      lines.push(`Ветка Фичи \`${branch}\`:`);
      lines.push(...branchLinks(deps, config, task.repos, ws, branch));
    }
  }
  lines.push(`Прочитай ${ws}/AGENTS.md и ${ws}/TASK.md, затем \`flow recall ${task.id}\`. Гейт этапа проверяй по stages.json, не по памяти чата. Диагностика только через orca-env.`);
  return lines.join("\n");
}

function cmdAgent(deps: CliDeps, argv: string[]): void {
  const id = argv[0];
  if (!id) die(deps, "usage: flow agent <id>");
  const registry = readRegistry(deps.metaDir);
  const task = registry.tasks[id];
  if (!task) die(deps, `task not found: ${id}`);
  const ws = task.workspacePath;
  if (!fs.existsSync(ws)) die(deps, `workspace is missing: ${ws}`);
  const feature = task.parentId ? registry.tasks[task.parentId] ?? null : null;
  writeAgents(ws, task, feature);
  const dir = agentWorkdir(task, readConfig(deps.metaDir));
  if (dir === ws) deps.space.registerFolder(dir); // Orca запускает агента только в известном workspace
  const prompt = agentPrompt(deps, task, feature);
  const ok = deps.space.available() ? deps.space.launchAgent(dir, prompt) : deps.agent.launchChat(dir, prompt);
  if (!ok) die(deps, "cannot launch agent (orca/opencode)");
  deps.out(`агент запущен: ${dir}`);
}

function cmdUp(deps: CliDeps, argv: string[]): void {
  const id = argv[0];
  if (!id) die(deps, "usage: flow up <id>");
  const config = readConfig(deps.metaDir);
  const registry = readRegistry(deps.metaDir);
  const task = registry.tasks[id];
  if (!task) die(deps, `task not found: ${id}`);
  if (task.status !== "active") die(deps, `${id} is not active: ${task.status}`);
  const ws = task.workspacePath;
  if (!fs.existsSync(ws)) die(deps, `workspace is missing: ${ws}`);
  const file = path.join(ws, "docker-compose.yml");
  if (deps.docker.composePsRunning(task.dockerProject, file)) {
    deps.out(`${id} is already up`);
    return;
  }
  const busy = new Set<number>();
  const alloc = allocatePorts(id, task.repos, config, registry, busy);
  task.slot = alloc.slot;
  task.ports = alloc.ports;
  task.endpoints = alloc.endpoints;
  task.activeRepos = task.repos;
  writeJsonAtomic(path.join(deps.metaDir, "state.json"), registry);
  for (const repo of task.repos) shareRepoEnv(ws, repo, config, deps);
  fs.writeFileSync(path.join(ws, ".env"), writeEnv(id, ws, task.dockerProject, task.repos, config, alloc.slot));
  const tpl = fs.readFileSync(path.join(deps.metaDir, "templates/docker-compose.tpl.yml"), "utf8");
  fs.writeFileSync(file, renderCompose(tpl, task.repos));
  applyBffPatch(ws, config, deps);
  const feature = task.parentId ? registry.tasks[task.parentId] ?? null : null;
  writeAgents(ws, task, feature);
  if (deps.startStack) {
    const sfile = stagesPath(ws);
    let sdata = readStages(sfile) ?? initStages("task", id);
    const s6 = sdata.stages.find((x) => x.stage === 6);
    if (s6 && s6.status === "pending") {
      sdata = setStageStatus(sdata, 6, "running");
      writeStages(sfile, sdata);
    }
    if (!deps.docker.composeUp(task.dockerProject, file)) {
      const detail = deps.docker.lastError ?? "";
      die(deps, `docker compose up failed${detail ? `:\n${detail}` : ""}`);
    }
    const composeOutput = deps.docker.lastOutput ?? "";
    if (composeOutput) deps.out(composeOutput);
  } else {
    deps.out("stack plan ready (env/compose written); pass --start to launch containers");
  }
  if (!deps.space.available()) deps.agent.launchChat(ws, agentPrompt(deps, task, feature));
  deps.out(`${id} slot=${alloc.slot} endpoints=${JSON.stringify(alloc.endpoints)}`);
  if (deps.startStack) recordStages(deps, id, [6, 7], "авто: стек запущен, рабочее место готово");
}

const COMMIT_TYPES: Record<TaskType, string> = { bug: "fix", task: "feat", story: "feat" };
const PROTECTED_BRANCHES = ["stage", "master", "main", "develop"];

function taskRepoDirs(config: Config, task: Task): Array<{ repo: string; dir: string }> {
  const dirs: Array<{ repo: string; dir: string }> = [];
  for (const repo of task.repos) {
    const dir = repoPath(config, task.workspacePath, repo);
    if (dir) dirs.push({ repo, dir });
  }
  return dirs;
}

function commitSubject(task: Task): string {
  const withoutId = task.titleRu.replace(/^[A-Z]+-\d+\s*[:\u2014-]\s*/, "");
  return cleanSummary(withoutId).slice(0, 64);
}

function commitRepo(deps: CliDeps, dir: string, type: string, subject: string): boolean {
  deps.git.addAll(dir);
  if (fs.existsSync(path.join(dir, "changelog.config.js"))) {
    const cz = spawnSync(
      "npx",
      ["git-cz", "--non-interactive", "--type", type, "--subject", subject],
      { cwd: dir, encoding: "utf8" }
    );
    if (cz.status === 0) return true;
  }
  if (deps.git.commit(dir, `${type}: ${subject}`)) return true;
  return deps.git.statusPorcelain(dir).length === 0;
}

function cmdCommit(deps: CliDeps, argv: string[]): void {
  const { pos, flags } = parseFlags(argv);
  const id = pos[0];
  if (!id) die(deps, "usage: flow commit <id> [--subject text] [--type fix]");
  const config = readConfig(deps.metaDir);
  const task = readRegistry(deps.metaDir).tasks[id];
  if (!task) die(deps, `task not found: ${id}`);
  const type = (flags.type as string) ?? COMMIT_TYPES[task.type];
  const subject = ((flags.subject as string) ?? commitSubject(task)).slice(0, 64);
  let committed = 0;
  for (const { repo, dir } of taskRepoDirs(config, task)) {
    if (deps.git.statusPorcelain(dir).length === 0) continue;
    if (!commitRepo(deps, dir, type, subject)) die(deps, `${repo}: commit failed`);
    deps.out(`${repo}: ${type}: ${subject}`);
    committed++;
  }
  deps.out(committed === 0 ? "нечего коммитить: рабочее дерево чистое" : `закоммичено репозиториев: ${committed}`);
}

function cmdMr(deps: CliDeps, argv: string[]): void {
  const id = argv[0];
  if (!id) die(deps, "usage: flow mr <id>");
  const config = readConfig(deps.metaDir);
  const registry = readRegistry(deps.metaDir);
  const task = registry.tasks[id];
  if (!task) die(deps, `task not found: ${id}`);
  const feature = task.parentId ? registry.tasks[task.parentId] ?? null : null;
  const branch = task.branch;
  if (PROTECTED_BRANCHES.includes(branch) || task.type !== "story" && !branch.startsWith(`${id}`)) {
    die(deps, `push из '${branch}' запрещён: MR оформляется только из ветки задачи`);
  }
  const target = task.type === "story" ? "stage" : feature?.branch ?? "stage";
  if (target !== "stage" && !target.startsWith("feature-")) {
    die(deps, `цель MR '${target}' не stage и не feature-ветка`);
  }
  const link = task.type === "story" ? "Сторя" : "Задача";
  const title = task.type === "story" ? `[${branch.replace(/^feature-/, "").replace(/-REALT-\d+$/, "")}]:${id}` : branch;
  const description = `${task.titleRu}\n\n${link}: https://youtrack.realt.by/issue/${id}`;
  for (const { repo, dir } of taskRepoDirs(config, task)) {
    const push = spawnSync("git", ["-C", dir, "push", "-u", "origin", branch], { encoding: "utf8" });
    if (push.status !== 0) die(deps, `${repo}: push failed: ${(push.stderr ?? "").trim()}`);
    const mr = spawnSync(
      "glab",
      ["mr", "create", "--source-branch", branch, "--target-branch", target, "--title", title, "--description", description, "--yes"],
      { cwd: dir, encoding: "utf8" }
    );
    if (mr.status !== 0) die(deps, `${repo}: glab mr create failed: ${(mr.stderr || mr.stdout || "").trim()}`);
    deps.out(`${repo}: MR ${branch} → ${target}`);
    const url = /https?:\/\/\S+/.exec(mr.stdout ?? "");
    if (url) deps.out(`  ${url[0]}`);
  }
}

function cmdMerge(deps: CliDeps, argv: string[]): void {
  const { pos, flags } = parseFlags(argv);
  const id = pos[0];
  if (!id) die(deps, "usage: flow merge <id> [--yes]");
  const registry = readRegistry(deps.metaDir);
  const config = readConfig(deps.metaDir);
  const task = registry.tasks[id];
  if (!task) die(deps, `task not found: ${id}`);
  const feature = task.parentId ? registry.tasks[task.parentId] ?? null : null;
  const dirtyRepos = task.repos.filter((r) => {
    const p = path.join(task.workspacePath, r);
    if (!fs.existsSync(p)) return false;
    const bff = path.join(p, "src/create-app-server.ts");
    const content = fs.existsSync(bff) ? fs.readFileSync(bff, "utf8") : null;
    return taskDirtyFiles(deps.git.statusPorcelain(p), content).length > 0;
  });
  const pre = mergePrecheck({
    task, feature, featureInRegistry: !!feature,
    taskWorkspaceExists: fs.existsSync(task.workspacePath),
    featureWorkspaceExists: !!feature && fs.existsSync(feature.workspacePath),
    dirtyRepos,
  });
  if (!("ok" in pre) || !pre.ok) die(deps, "message" in pre ? pre.message : "merge blocked");
  let lockChanged = false;
  for (const repo of task.repos) {
    const fp = path.join(feature!.workspacePath, repo);
    if (!fs.existsSync(fp)) die(deps, `feature has no ${repo} worktree: ${fp}`);
    if (!deps.git.merge(fp, task.branch, `Merge ${id} into ${task.parentId}`)) {
      deps.git.mergeAbort(fp);
      die(deps, `merge conflict in ${repo}: feature left untouched`);
    }
    deps.out(`${repo}: ${deps.git.logOneline(fp)}`);
    if (deps.git.diffNames(fp, "ORIG_HEAD", "HEAD").includes("package-lock.json")) lockChanged = true;
  }
  const stop = deps.assumeYes || flags.yes;
  if (stop) {
    deps.docker.composeDown(task.dockerProject, path.join(task.workspacePath, "docker-compose.yml"), false);
    task.status = "merged";
    writeJsonAtomic(path.join(deps.metaDir, "state.json"), registry);
    recordStages(deps, id, [9], "авто: ветка влита в Фичу");
    deps.out(`${id} merged into ${task.parentId}, stack stopped`);
  } else {
    deps.out(`${id} stays active (merged into feature, stack not stopped)`);
  }
  void lockChanged;
}

function cmdFinish(deps: CliDeps, argv: string[]): void {
  const { pos, flags } = parseFlags(argv);
  const id = pos[0];
  if (!id) die(deps, "usage: flow finish <id> [--dry-run] [--yes]");
  const registry = readRegistry(deps.metaDir);
  const config = readConfig(deps.metaDir);
  const task = registry.tasks[id];
  if (!task) die(deps, `task not found: ${id}`);
  if (task.status === "closed") {
    deps.out(`${id} is already closed`);
    return;
  }
  const feature = task.parentId ? registry.tasks[task.parentId] ?? null : null;
  const dirty = task.repos.some((r) => {
    const p = path.join(task.workspacePath, r);
    return fs.existsSync(p) && deps.git.statusPorcelain(p).length > 0;
  });
  const unmerged = task.type !== "story" && feature
    ? task.repos.filter((r) => !deps.git.isAncestor(path.join(task.workspacePath, r), task.branch, feature.branch))
    : [];
  const activeChildren = Object.values(registry.tasks).filter((t) => t.parentId === id && t.status !== "closed").map((t) => t.id);
  const gates = finishGates({ task, hasFeature: !!feature, dirty, unmerged, unpushed: [], activeChildren });
  for (const g of gates) deps.out(`gate ${g.point}: ${g.question}`);
  if (gates.length > 0 && !(deps.assumeYes || flags.yes)) die(deps, "finish gates require approval (--yes)");
  if (flags["dry-run"]) {
    deps.out("dry run: nothing changed");
    return;
  }
  deps.docker.composeDown(task.dockerProject, path.join(task.workspacePath, "docker-compose.yml"), true);
  deps.space.closeTerminals(task.workspacePath);
  deps.space.hideRepo(task.workspacePath);
  for (const repo of task.repos) {
    const p = path.join(task.workspacePath, repo);
    if (fs.existsSync(p)) deps.git.worktreeRemove(path.join(config.donorsRoot, `${repo}.git`), p, true);
  }
  const flowDir = path.join(task.workspacePath, ".flow");
  recordStages(deps, id, [10], "авто: стек погашен, копии удалены, слот освобождён");
  if (fs.existsSync(flowDir)) {
    const archive = path.join(deps.metaDir, "archive", id);
    fs.mkdirSync(archive, { recursive: true });
    fs.cpSync(flowDir, path.join(archive, ".flow"), { recursive: true });
  }
  fs.rmSync(task.workspacePath, { recursive: true, force: true });
  task.status = "closed";
  task.slot = null;
  for (const t of Object.values(registry.tasks)) if (t.parentId === id) t.parentId = null;
  writeJsonAtomic(path.join(deps.metaDir, "state.json"), registry);
  deps.out(`${id} closed`);
}

function cmdRecall(deps: CliDeps, argv: string[]): void {
  const target = argv[0];
  if (!target) die(deps, "usage: flow recall <id|global>");
  const registry = readRegistry(deps.metaDir);
  const file = target === "global" ? globalStagesPath(deps.metaDir) : stagesPath(registry.tasks[target]?.workspacePath ?? "");
  if (target !== "global") {
    const t = registry.tasks[target];
    if (!t) die(deps, `task not found in the registry: ${target}`);
    deps.out(`task: ${t.id}  type: ${t.type}  status: ${t.status}`);
    deps.out(`title: ${t.titleRu ?? ""}`);
    deps.out(`branch: ${t.branch}`);
    deps.out(`workspace: ${t.workspacePath}`);
    deps.out("endpoints:");
    const eps = Object.entries(t.endpoints);
    if (eps.length === 0) deps.out("  none");
    else for (const [r, u] of eps) deps.out(`  ${r}: ${u}`);
  }
  const data = readStages(file);
  if (!data) {
    deps.out("no memory yet");
    return;
  }
  deps.out(`current stage: ${data.currentStage ?? "none"}`);
  for (const s of [...data.stages].sort((a, b) => a.stage - b.stage)) deps.out(`  ${s.stage}: ${s.status}`);
  for (const s of data.stages) for (const a of s.approvals) deps.out(`  approval stage ${a.stage}: ${a.approvedBy} ${a.approvedAt} phrase "${a.phrase}"`);
}

function cmdStage(deps: CliDeps, argv: string[]): void {
  const { pos, flags } = parseFlags(argv);
  const [target, nStr, status] = pos;
  if (!target || !nStr || !status) die(deps, "usage: flow stage <id|global> <n> running|passed|failed [--report text]");
  const n = Number(nStr);
  const registry = readRegistry(deps.metaDir);
  const file = target === "global" ? globalStagesPath(deps.metaDir) : stagesPath(registry.tasks[target]?.workspacePath ?? "");
  let data = readStages(file) ?? initStages(target === "global" ? "global" : "task", target === "global" ? null : target);
  data = setStageStatus(data, n, status as any, flags.report as string | undefined);
  const errs = validateStages(data);
  if (errs.length) die(deps, errs.join("; "));
  writeStages(file, data);
  deps.out(`stage ${target} ${n}: ${status}`);
}

function cmdApprove(deps: CliDeps, argv: string[]): void {
  const { pos, flags } = parseFlags(argv);
  const [target, nStr] = pos;
  const phrase = flags.phrase as string;
  if (!target || !nStr || !phrase) die(deps, 'usage: flow approve <id|global> <n> --phrase "этап N ок"');
  const registry = readRegistry(deps.metaDir);
  const file = target === "global" ? globalStagesPath(deps.metaDir) : stagesPath(registry.tasks[target]?.workspacePath ?? "");
  const data = readStages(file);
  if (!data) die(deps, `no stages memory: ${file}`);
  const next = approveStage(data, Number(nStr), phrase);
  writeStages(file, next);
  deps.out(`approved: ${target} stage ${nStr}: ${phrase}`);
}

function recordStages(deps: CliDeps, id: string, nums: number[], report: string, metaDir = deps.metaDir): void {
  const registry = readRegistry(metaDir);
  const task = registry.tasks[id];
  if (!task || !fs.existsSync(task.workspacePath)) return;
  const file = stagesPath(task.workspacePath);
  let data: StagesFile = readStages(file) ?? initStages("task", id);
  for (const n of nums) {
    const s = data.stages.find((x) => x.stage === n);
    if (!s || s.status === "approved" || s.status === "passed") continue;
    if (s.status === "pending") data = setStageStatus(data, n, "running");
    data = setStageStatus(data, n, "passed", report);
  }
  writeStages(file, data);
}

function cmdState(deps: CliDeps, argv: string[]): void {
  const registry = readRegistry(deps.metaDir);
  if (argv[0] === "list") {
    for (const t of Object.values(registry.tasks)) deps.out(`${t.id}\t${t.type}\t${t.status}\t${t.branch}\t${t.workspacePath}`);
  } else if (argv[0] === "show" && argv[1]) {
    const t = registry.tasks[argv[1]];
    if (!t) die(deps, `task not found: ${argv[1]}`);
    deps.out(JSON.stringify(t, null, 2));
  } else die(deps, "usage: flow state list|show <id>");
}

function cmdSwitch(deps: CliDeps, argv: string[]): void {
  const { pos, flags } = parseFlags(argv);
  const branch = normalizeRef(pos[0] ?? "");
  if (!branch) die(deps, "usage: flow switch <branch> --from <base> --repos <list>");
  const base = normalizeRef((flags.from as string) ?? "stage");
  const config = readConfig(deps.metaDir);
  const repos = resolveRepos((flags.repos as string) ?? "", config, false);
  if (repos.length === 0) die(deps, "no repositories selected");
  const bases: Record<string, string> = {};
  for (const repo of repos) {
    const p = path.join(config.mainRoot, repo);
    if (!fs.existsSync(p)) die(deps, `main clone is missing: ${p}`);
    let effBase = base;
    let hasBase = deps.git.revParseVerify(p, `origin/${effBase}`) || deps.git.revParseVerify(p, effBase);
    if (!hasBase) {
      const donor = path.join(config.donorsRoot, `${repo}.git`);
      if (fs.existsSync(donor) && deps.git.fetchFrom(p, donor, effBase)) {
        deps.out(`${repo}: fetched base ${effBase} from the donor`);
        hasBase = true;
      }
    }
    if (!hasBase) {
      effBase = "stage";
      deps.out(`warning: ${base} is not in ${repo}; branching from stage instead`);
    }
    if (!deps.git.checkoutNew(p, branch, effBase)) {
      die(deps, `cannot create ${branch} from ${effBase} in ${repo}: ${deps.git.lastError ?? "unknown error"}`);
    }
    deps.out(`${repo}: ${branch} (from ${effBase})`);
    bases[repo] = effBase;
  }

  const id = (flags.id as string) || null;
  if (!id) return;
  const registry = readRegistry(deps.metaDir);
  const type = ((flags.type as string) || "task") as TaskType;
  const parentId = (flags.parent as string) || null;
  const summary = (flags.summary as string) || id;
  const ws = path.join(config.workspacesRoot, branch);
  fs.mkdirSync(ws, { recursive: true });
  const task: Task = {
    id, type, parentId, parentExternal: false,
    titleRu: `${id}: ${cleanSummary(summary)}`, description: (flags.description as string) || "",
    branch, workspacePath: ws, repos, activeRepos: repos,
    slot: null, dockerProject: dockerProject(branch), ports: {}, endpoints: {},
    status: "active", mode: "simple", bases,
    createdAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"), children: [],
  };
  registry.tasks[id] = task;
  writeJsonAtomic(path.join(deps.metaDir, "state.json"), registry);
  writeStages(stagesPath(ws), initStages("task", id));
  recordStages(deps, id, [1, 2], "авто: задача создана, ветка отведена и проект переключён (без worktree)");
  deps.out(`${id}: registered (simple mode, no worktree, no docker)`);
}

function cmdDoctor(deps: CliDeps): void {
  let fails = 0;
  const ok = (m: string) => deps.out(`  ok    ${m}`);
  const fail = (m: string) => { fails++; deps.out(`  FAIL  ${m}`); };
  const config = readConfig(deps.metaDir);
  const registry = readRegistry(deps.metaDir);
  ok(`config.json`);
  ok(`state.json (${Object.keys(registry.tasks).length} tasks)`);
  if (fs.existsSync(config.workspacesRoot)) ok("workspaces root"); else fail("workspaces root missing");
  for (const [repo, rc] of Object.entries(config.repos)) {
    const donor = path.join(config.donorsRoot, `${repo}.git`);
    if (!fs.existsSync(donor)) fail(`donor ${repo}.git missing`);
    else if (!deps.git.revParseVerify(donor, rc.baseBranch)) fail(`donor ${repo}.git has no ${rc.baseBranch}`);
    else ok(`donor ${repo}.git (${rc.baseBranch})`);
  }
  if (fs.existsSync(config.certs.cert) && fs.existsSync(config.certs.key)) {
    const san = deps.hosts.certSan(config.certs.cert);
    for (const d of Object.values(config.domains)) {
      const host = d.replace(/^https:\/\//, "");
      if (san.includes(`DNS:${host}`)) ok(`SAN covers ${host}`); else fail(`SAN missing ${host}`);
    }
  } else fail("certificate or key missing");
  for (const d of Object.values(config.domains)) {
    const host = d.replace(/^https:\/\//, "");
    if (deps.hosts.resolveHost(host)) ok(`${host} -> 127.0.0.1`); else fail(`${host} not 127.0.0.1`);
  }
  if (deps.docker.info()) ok("docker daemon"); else fail("docker daemon not running");
  if (deps.docker.composeVersion()) ok("docker compose"); else fail("docker compose missing");
  const tpl = path.join(deps.metaDir, "templates/docker-compose.tpl.yml");
  if (!fs.existsSync(tpl)) fail("compose template missing");
  else {
    const text = fs.readFileSync(tpl, "utf8");
    const open = (text.match(/^# @repos /gm) ?? []).length;
    const close = (text.match(/^# @repos-end$/gm) ?? []).length;
    if (open === close) ok(`template (${open} repo blocks)`); else fail("template unbalanced @repos markers");
  }
  let warns = 0;
  const legacyEnv = fs.existsSync(config.toolkitDir) ? fs.readdirSync(config.toolkitDir).filter((f) => f.endsWith(".env")).length : 0;
  if (legacyEnv > 0) { warns++; deps.out(`  warn  legacy env files outside the registry: ${legacyEnv} in ${config.toolkitDir}`); }
  const known = new Set(Object.values(registry.tasks).map((t) => t.dockerProject));
  const stray = deps.docker.psProjects().filter((p) => !known.has(p));
  if (stray.length > 0) { warns++; deps.out(`  warn  running compose projects outside the registry: ${stray.join(" ")}`); }
  deps.out(`\n${fails} failures, ${warns} warnings`);
  if (fails > 0) throw new Error(`doctor: ${fails} failures`);
  const gfile = globalStagesPath(deps.metaDir);
  let g = readStages(gfile) ?? initStages("global", null);
  g = setStageStatus(g, 0, "running");
  g = setStageStatus(g, 0, "passed", "авто: doctor без ошибок");
  writeStages(gfile, g);
}

function cmdIntake(deps: CliDeps, argv: string[]): void {
  const { pos, flags } = parseFlags(argv);
  const input = pos[0];
  const type = flags.type as TaskType;
  if (!input || !type) die(deps, "usage: flow intake <id|url> --type story|task|bug");
  const plan = intake(deps, input, type, flags.fixture as string | undefined);
  deps.out(JSON.stringify(plan, null, 2));
}

const USAGE = `usage: flow <command> [options]

  new <id|url> --type story|task|bug [--repos list] [--fixture file] [--dry-run]
  up <id> [--start]      start (or plan) the Docker stack of a task
  agent <id>             launch opencode agent in the task workspace with task context
  commit <id> [--subject text] [--type fix]   commit changes in every repo of the task
  mr <id>                push the task branch and open a GitLab MR
  intake <id|url> --type story|task|bug   issue -> JSON
  switch <branch> --repos <list>          переключить основной клон на ветку (без окружения)
  state list|show <id>   registry
  merge <id> [--yes]     merge a task branch into its feature
  finish <id> [--dry-run] [--yes]   shut a task down
  recall <id|global>     stages, approvals, decisions/journal
  stage <id|global> <n> running|passed|failed [--report text]
  approve <id|global> <n> --phrase "этап N ок"
  doctor                 read-only check of config, donors, certs, hosts, docker
  --version              print version`;

export function runCli(argv: string[], deps: CliDeps): void {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case "new": return cmdNew(deps, rest);
    case "up": return cmdUp(deps, rest);
    case "agent": return cmdAgent(deps, rest);
    case "commit": return cmdCommit(deps, rest);
    case "mr": return cmdMr(deps, rest);
    case "merge": return cmdMerge(deps, rest);
    case "finish": return cmdFinish(deps, rest);
    case "recall": return cmdRecall(deps, rest);
    case "stage": return cmdStage(deps, rest);
    case "approve": return cmdApprove(deps, rest);
    case "state": return cmdState(deps, rest);
    case "doctor": return cmdDoctor(deps);
    case "intake": return cmdIntake(deps, rest);
    case "switch": return cmdSwitch(deps, rest);
    case "--version":
    case "-v": {
      const config = readConfig(deps.metaDir);
      const vf = path.join(config.toolkitDir, "orca-flow/VERSION");
      deps.out(fs.existsSync(vf) ? fs.readFileSync(vf, "utf8").trim() : "0.1.0");
      return;
    }
    case "--help":
    case "-h":
    case "help":
    case undefined:
      deps.out(USAGE);
      return;
    default: die(deps, `unknown command: ${cmd ?? "(none)"}`);
  }
}
