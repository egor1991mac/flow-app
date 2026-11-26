import {
  HOME,
  META,
  createTask,
  editTask,
  getJob,
  intakePreview,
  invoke,
  startJob,
  switchTask,
  branchNames,
  taskBranches,
  ytBoard,
  ytSprints,
  ytUsers,
  ytCreateIssue,
  ytGrill,
  launchGrill,
  readConfig,
  readRegistry,
  readStages,
  stagesPath,
  globalStagesPath,
  tailJsonl,
} from "./flow-api.ts";
import type {
  BranchRow,
  CreateTaskInput,
  CreateTaskResult,
  EditTaskInput,
  IntakeResult,
  InvokeResult,
  Job,
  SwitchTaskInput,
  YtBoardResult,
  YtSprintsResult,
  YtUsersResult,
  YtCreateInput,
  YtCreateResult,
  YtGrill,
  GrillLaunch,
} from "./flow-api.ts";
import { indexedCount, searchMemory } from "./vector-api.ts";
import { taskGit } from "./task-git.ts";
import type { RepoGitRow } from "./task-git.ts";
import type { SearchHit } from "./vector-api.ts";

export interface FlowApi {
  home: string;
  meta: string;
  getTasks(): unknown[];
  getTask(id: string): unknown;
  getTaskStages(taskId: string): unknown;
  getTaskJournal(taskId: string): { journal: unknown[]; decisions: unknown[] };
  getTaskBranches(taskId: string): BranchRow[] | null;
  getTaskGit(taskId: string): RepoGitRow[];
  getGlobalStages(): unknown;
  getConfig(): unknown;
  getBranchNames(parentId?: string | null, part?: string | null): string[];
  getJob(id: string): Job | null;
  search(q: string): { ok: boolean; indexed: number; results: SearchHit[] };
  intake(input: string): IntakeResult;
  ytBoard(query: string, limit?: number): YtBoardResult;
  ytSprints(): YtSprintsResult;
  ytUsers(query?: string, limit?: number): YtUsersResult;
  ytCreateIssue(input: YtCreateInput): YtCreateResult;
  ytGrill(slug: string): YtGrill;
  launchGrill(slug: string, prompt: string): GrillLaunch;
  createTask(input: CreateTaskInput): CreateTaskResult;
  editTask(input: EditTaskInput): InvokeResult;
  switchTask(input: SwitchTaskInput): InvokeResult;
  startTask(id: string, start: boolean): InvokeResult & { jobId?: string };
  setStage(id: string, n: number, status: string, report?: string | null): InvokeResult;
  approveStage(id: string, n: number, phrase: string): InvokeResult;
  mergeTask(id: string, yes: boolean): InvokeResult;
  finishTask(id: string, yes: boolean, dryRun: boolean): InvokeResult;
  launchAgent(id: string): InvokeResult;
  commitTask(id: string, subject?: string | null, type?: string | null, repo?: string | null): InvokeResult;
  createTaskMr(id: string, repo?: string | null): InvokeResult;
}

export const getDataSources = (): FlowApi => ({
  home: HOME,
  meta: META,

  getTasks() {
    return Object.values(readRegistry(META).tasks);
  },

  getTask(id) {
    return readRegistry(META).tasks[id] ?? null;
  },

  getTaskStages(taskId) {
    const task = readRegistry(META).tasks[taskId];
    return task ? readStages(stagesPath(task.workspacePath)) ?? null : null;
  },

  getTaskJournal(taskId) {
    const task = readRegistry(META).tasks[taskId];
    const dir = task ? `${task.workspacePath}/.flow` : "";
    return {
      journal: tailJsonl(`${dir}/journal.jsonl`, 50),
      decisions: tailJsonl(`${dir}/decisions.jsonl`, 50),
    };
  },

  getTaskBranches(taskId) {
    const task = readRegistry(META).tasks[taskId];
    return task ? taskBranches(task) : null;
  },

  getTaskGit(taskId) {
    return taskGit(taskId);
  },

  getGlobalStages() {
    return readStages(globalStagesPath(META)) ?? null;
  },

  getConfig() {
    return readConfig(META);
  },

  getBranchNames(parentId?: string | null, part?: string | null) {
    return branchNames(parentId, part);
  },

  getJob(id) {
    return getJob(id);
  },

  search(q) {
    return { ok: true, indexed: indexedCount(), results: searchMemory(q) };
  },

  intake(input) {
    return intakePreview(input);
  },

  ytBoard(query, limit = 300) {
    return ytBoard(query, limit);
  },

  ytSprints() {
    return ytSprints();
  },

  ytUsers(query = "", limit = 100) {
    return ytUsers(query, limit);
  },

  ytCreateIssue(input) {
    return ytCreateIssue(input);
  },

  ytGrill(slug) {
    return ytGrill(slug);
  },

  launchGrill(slug, prompt) {
    return launchGrill(slug, prompt);
  },

  createTask(input) {
    return createTask(input);
  },

  editTask(input) {
    return editTask(input);
  },

  switchTask(input) {
    return switchTask(input);
  },

  startTask(id, start) {
    if (!start) return invoke(["up", id]);
    return { ok: true, output: [], jobId: startJob(["up", id, "--start"]) };
  },

  setStage(id, n, status, report) {
    return invoke(["stage", id, String(n), status, ...(report ? ["--report", report] : [])]);
  },

  approveStage(id, n, phrase) {
    return invoke(["approve", id, String(n), "--phrase", phrase]);
  },

  mergeTask(id, yes) {
    return invoke(["merge", id, ...(yes ? ["--yes"] : [])], { assumeYes: yes });
  },

  finishTask(id, yes, dryRun) {
    return invoke(["finish", id, ...(yes ? ["--yes"] : []), ...(dryRun ? ["--dry-run"] : [])], {
      assumeYes: yes,
    });
  },

  launchAgent(id) {
    return invoke(["agent", id]);
  },

  commitTask(id, subject, type, repo) {
    return invoke([
      "commit",
      id,
      ...(subject ? ["--subject", subject] : []),
      ...(type ? ["--type", type] : []),
      ...(repo ? ["--repo", repo] : []),
    ]);
  },

  createTaskMr(id, repo) {
    return invoke(["mr", id, ...(repo ? ["--repo", repo] : [])]);
  },
});
