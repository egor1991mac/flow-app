import type { StagesFile, StageStatus, Stage, Task, Approval } from "./types.ts";
import { APPROVAL_PHRASE, STAGE_STATUSES } from "./types.ts";
import { nowIso } from "./store.ts";

const TRANSITIONS: Array<[StageStatus, StageStatus]> = [
  ["pending", "running"],
  ["failed", "running"],
  ["running", "passed"],
  ["running", "failed"],
  ["passed", "failed"],
];

export function canTransition(from: StageStatus, to: StageStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS.some(([a, b]) => a === from && b === to);
}

export function canStartStage(priorApproved: boolean): boolean {
  return priorApproved;
}

function findStage(file: StagesFile, n: number): Stage {
  const s = file.stages.find((x) => x.stage === n);
  if (!s) throw new Error(`stage ${n} not found`);
  return s;
}

export function setStageStatus(file: StagesFile, n: number, status: StageStatus, evidence?: string): StagesFile {
  if (n < 0 || n > 10) throw new Error(`stage number out of range: ${n}`);
  if (!STAGE_STATUSES.includes(status)) throw new Error(`unknown stage status: ${status}`);
  if (status === "approved") throw new Error("approved is set only by approveStage");
  const next: StagesFile = JSON.parse(JSON.stringify(file));
  const s = findStage(next, n);
  if (s.status === status) return next;
  if (!canTransition(s.status, status)) throw new Error(`stage ${n}: transition ${s.status} -> ${status} is not allowed`);
  const ts = nowIso();
  if (status === "running") {
    const runId = `s${n}r${s.runs.length}-${ts}`;
    s.runs.push({ runId, startedAt: ts, finishedAt: null, evidence: [] });
    s.status = "running";
    next.currentStage = n;
  } else {
    s.status = status;
    const last = s.runs[s.runs.length - 1];
    if (last) {
      last.finishedAt = ts;
      if (evidence !== undefined) last.report = evidence;
    }
  }
  return next;
}

export function approveStage(file: StagesFile, n: number, phrase: string): StagesFile {
  if (n < 0 || n > 10) throw new Error(`stage number out of range: ${n}`);
  if (!APPROVAL_PHRASE.test(phrase)) throw new Error(`phrase is not the canonical 'этап N ок': ${phrase}`);
  const m = /^\s*[Ээ][Тт][Аа][Пп]\s+(10|[0-9])\s+/.exec(phrase);
  const phraseN = m ? Number(m[1]) : NaN;
  if (phraseN !== n) throw new Error(`phrase mentions stage ${phraseN}, expected ${n}`);
  const next: StagesFile = JSON.parse(JSON.stringify(file));
  const s = findStage(next, n);
  if (s.status !== "passed") throw new Error(`stage ${n} is ${s.status}, not passed`);
  const last = s.runs[s.runs.length - 1];
  if (!last) throw new Error(`stage ${n} has no run to approve`);
  const approval: Approval = { stage: n, approvedBy: "user", approvedAt: nowIso(), phrase, source: "chat-session", runId: last.runId };
  s.approvals.push(approval);
  s.status = "approved";
  return next;
}

export type GateResult = { ok: true } | { ok: false; message: string } | { ask: true; question: string };

export function mergePrecheck(ctx: {
  task: Task;
  feature: Task | null;
  featureInRegistry: boolean;
  taskWorkspaceExists: boolean;
  featureWorkspaceExists: boolean;
  dirtyRepos: string[];
}): GateResult {
  if (ctx.task.type !== "task" && ctx.task.type !== "bug") return { ok: false, message: `merge is only for task/bug, ${ctx.task.id} is ${ctx.task.type}` };
  if (ctx.task.status !== "active") return { ok: false, message: `${ctx.task.id} is ${ctx.task.status}, nothing to merge` };
  if (!ctx.task.parentId) return { ok: false, message: `${ctx.task.id} has no feature, nothing to merge into` };
  if (ctx.task.parentExternal) return { ok: false, message: `feature ${ctx.task.parentId} is outside the registry: merge manually` };
  if (!ctx.featureInRegistry || !ctx.feature) return { ok: false, message: `feature not found in the registry: ${ctx.task.parentId}` };
  if (ctx.feature.type !== "story") return { ok: false, message: `${ctx.task.parentId} is not a story` };
  if (!ctx.taskWorkspaceExists) return { ok: false, message: `task workspace is missing: ${ctx.task.workspacePath}` };
  if (!ctx.featureWorkspaceExists) return { ok: false, message: `feature workspace is missing: ${ctx.feature.workspacePath}` };
  if (ctx.dirtyRepos.length > 0) return { ok: false, message: `uncommitted changes in ${ctx.task.id}: ${ctx.dirtyRepos.join(", ")}` };
  return { ok: true };
}

export type FinishGate = { point: string; question: string };

export function finishGates(ctx: {
  task: Task;
  hasFeature: boolean;
  dirty: boolean;
  unmerged: string[];
  unpushed: string[];
  activeChildren: string[];
}): FinishGate[] {
  const gates: FinishGate[] = [];
  const isStory = ctx.task.type === "story";
  if (ctx.dirty) gates.push({ point: "finish-dirty", question: "uncommitted changes will be lost, remove the worktrees anyway?" });
  if (!isStory) {
    if (ctx.unmerged.length > 0) gates.push({ point: "finish-unmerged", question: "the branch is not merged, the code will be lost. Continue?" });
    else if (!ctx.hasFeature) gates.push({ point: "finish-no-feature", question: "continue without a merge check?" });
    if (ctx.unpushed.length > 0) gates.push({ point: "finish-unpushed", question: "the branch is not in origin, continue?" });
  }
  if (isStory && ctx.activeChildren.length > 0) gates.push({ point: "finish-children", question: `children are still active, close ${ctx.task.id} anyway?` });
  return gates;
}
