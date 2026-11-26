export type {
  Task,
  TaskStatus,
  TaskType,
  StagesFile,
  Stage,
  StageStatus,
  Approval,
} from "../../../flow-core/src/types.ts";

export interface BranchRow {
  repo: string;
  branch: string;
  url: string | null;
  base: string | null;
  baseUrl: string | null;
}

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

export interface DecisionRow {
  id: string;
  ts: string;
  stage?: number | null;
  point: string;
  input: string;
  choice: string;
  why?: string | null;
  actor: string;
}

export interface JournalEventRow {
  id: string;
  ts: string;
  event: string;
  details?: unknown;
}

export interface JournalData {
  journal: JournalEventRow[];
  decisions: DecisionRow[];
}

export interface SearchHit {
  taskId: string;
  kind: string;
  snippet: string;
  score: number;
  ts: string | null;
}

export interface SearchResponse {
  ok: boolean;
  indexed: number;
  results: SearchHit[];
}

export interface IntakeResponse {
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
  error?: string | null;
}

export interface RepoConfig {
  kind?: string | null;
  pair: string | null;
  service?: string | null;
}

export interface AppConfig {
  repos: Record<string, RepoConfig>;
  [key: string]: unknown;
}

export interface InvokeResult {
  ok: boolean;
  output: string[];
  error?: string | null;
  err?: string[] | null;
}

export interface StartResult extends InvokeResult {
  jobId?: string | null;
}

export interface Job {
  log: string;
  done: boolean;
  code: number | null;
}

export interface YtIssue {
  id: string;
  summary: string;
  state: string;
  assignee: string | null;
  assigneeLogin: string | null;
  priority: string | null;
  type: string | null;
  project: string | null;
  updated: number;
  url: string;
}

export interface YtSprint {
  id: string;
  name: string;
  start: number | null;
  finish: number | null;
  current: boolean;
}

export interface YtBoardData {
  ytBoard: {
    ok: boolean;
    error: string | null;
    truncated: boolean;
    issues: YtIssue[];
  };
}

export interface YtSprintsData {
  ytSprints: {
    ok: boolean;
    error: string | null;
    boardId: string;
    current: YtSprint | null;
    sprints: YtSprint[];
  };
}

export interface YtUser {
  login: string;
  name: string;
}

export interface YtUsersData {
  ytUsers: {
    ok: boolean;
    error: string | null;
    users: YtUser[];
  };
}

export interface YtGrillData {
  ytGrill: {
    path: string;
    content: string;
  };
}

export interface YtCreated {
  ok: boolean;
  error: string | null;
  id: string | null;
  url: string | null;
  warnings: string[];
}

export interface GrillLaunch {
  ok: boolean;
  error: string | null;
  path: string;
}
