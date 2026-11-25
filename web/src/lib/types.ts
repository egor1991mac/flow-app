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
