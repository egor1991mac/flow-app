export type TaskType = "story" | "task" | "bug";
export type TaskStatus = "active" | "merged" | "closed";
export type StageStatus = "pending" | "running" | "passed" | "failed" | "approved";
export type Actor = "auto" | "flag" | "env" | "user" | "agent";
export type JournalEventType = "created" | "up" | "slot" | "error" | "vpn-stop" | "merge" | "finish";
export type Scope = "task" | "global";

export interface Task {
  id: string;
  type: TaskType;
  parentId: string | null;
  parentExternal: boolean;
  titleRu: string;
  description?: string;
  branch: string;
  workspacePath: string;
  repos: string[];
  activeRepos: string[];
  slot: number | null;
  dockerProject: string;
  ports: Record<string, number>;
  endpoints: Record<string, string>;
  status: TaskStatus;
  mode?: "worktree" | "simple";
  bases?: Record<string, string>;
  createdAt: string;
  children: string[];
}

export interface Registry {
  version: 1;
  tasks: Record<string, Task>;
}

export interface RepoConfig {
  kind?: "ui" | "api";
  pair: string | null;
  baseBranch: string;
  service?: string;
}

export interface Config {
  version: 1;
  workspacesRoot: string;
  donorsRoot: string;
  mainRoot: string;
  toolkitDir: string;
  certs: { cert: string; key: string };
  domains: Record<string, string>;
  ports: Record<string, number>;
  offsetStep: number;
  maxSlots: number;
  healthcheck: { intervalSec: number; okStatuses?: number[] };
  repos: Record<string, RepoConfig>;
}

export interface Evidence {
  id: string;
  text: string;
  checked: boolean;
}

export interface Run {
  runId: string;
  startedAt: string;
  finishedAt?: string | null;
  report?: string;
  evidence: Evidence[];
}

export interface Approval {
  stage: number;
  approvedBy: "user";
  approvedAt: string;
  phrase: string;
  source: string;
  runId: string;
}

export interface Stage {
  stage: number;
  status: StageStatus;
  runs: Run[];
  approvals: Approval[];
}

export interface StagesFile {
  version: 1;
  scope: Scope;
  taskId: string | null;
  currentStage: number | null;
  stages: Stage[];
}

export interface Decision {
  id: string;
  ts: string;
  stage?: number | null;
  point: string;
  input: string;
  choice: string;
  why?: string;
  actor: Actor;
}

export interface JournalEvent {
  id: string;
  ts: string;
  event: JournalEventType;
  details?: unknown;
}

export const STAGE_STATUSES: StageStatus[] = ["pending", "running", "passed", "failed", "approved"];
export const TASK_TYPES: TaskType[] = ["story", "task", "bug"];
export const JOURNAL_EVENTS: JournalEventType[] = ["created", "up", "slot", "error", "vpn-stop", "merge", "finish"];
export const ACTORS: Actor[] = ["auto", "flag", "env", "user", "agent"];
export const APPROVAL_PHRASE = /^\s*[Ээ][Тт][Аа][Пп]\s+(10|[0-9])\s+[Оо][Кк]\.?\s*$/;
export const ISO_UTC = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z$/;
