import { spawnSync } from "node:child_process";
import type {
  YtCreateIssueInput,
  YtCreateIssueResult,
  YtIssueRow,
  YtSprintRow,
  YtUserRow,
  YtUsersResult,
  YouTrackPort,
} from "../ports.ts";

export type {
  YtCreateIssueInput,
  YtCreateIssueResult,
  YtIssueRow,
  YtIssuesResult,
  YtSprintRow,
  YtSprintsResult,
  YtUserRow,
  YtUsersResult,
} from "../ports.ts";

export function parseParents(links: unknown): string[] {
  if (!Array.isArray(links)) return [];
  const ids = new Set<string>();
  for (const l of links) {
    if (l?.linkType?.name === "Subtask" && l?.direction === "INWARD") {
      for (const i of l?.issues ?? []) if (i?.idReadable) ids.add(i.idReadable);
    }
  }
  return [...ids].sort();
}

export function issueField(issue: any, name: string): string {
  const fields = issue?.customFields ?? [];
  for (const f of fields) if (f?.name === name) return f?.value?.name ?? "";
  return "";
}

export function issueAttribute(issue: any, name: string): string {
  return issue?.[name] ?? "";
}

function yt(args: string[]): unknown {
  const r = spawnSync("youtrack", [...args, "--json"], { encoding: "utf8" });
  if (r.status !== 0) return null;
  try {
    return JSON.parse(r.stdout);
  } catch {
    return null;
  }
}

export interface SubtaskLinks {
  inward: string[];
  outward: string[];
  relates: string[];
}

export function parseSubtaskLinks(links: unknown): SubtaskLinks {
  const inward = new Set<string>();
  const outward = new Set<string>();
  const relates = new Set<string>();
  if (!Array.isArray(links)) return { inward: [], outward: [], relates: [] };
  for (const l of links) {
    const type = l?.linkType?.name;
    if (type !== "Subtask" && type !== "Relates") continue;
    const target = type === "Relates" ? relates : l?.direction === "INWARD" ? inward : l?.direction === "OUTWARD" ? outward : null;
    if (!target) continue;
    for (const i of l?.issues ?? []) if (i?.idReadable) target.add(i.idReadable);
  }
  return { inward: [...inward].sort(), outward: [...outward].sort(), relates: [...relates].sort() };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringField(source: unknown, key: string): string {
  if (!isRecord(source)) return "";
  const value = source[key];
  return typeof value === "string" ? value : "";
}

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textOf).filter((part) => part !== "").join(", ");
  if (isRecord(value)) return stringField(value, "name");
  return "";
}

function customValue(issue: unknown, name: string): unknown {
  if (!isRecord(issue) || !Array.isArray(issue.customFields)) return null;
  for (const field of issue.customFields) {
    if (isRecord(field) && field.name === name) return field.value;
  }
  return null;
}

function customText(issue: unknown, name: string): string {
  return textOf(customValue(issue, name));
}

function millis(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

interface YtRun {
  ok: boolean;
  data?: unknown;
  error?: string;
}

function jsonErrorMessage(data: unknown): string {
  if (!isRecord(data) || !("error" in data)) return "";
  const error = data.error;
  if (typeof error === "string") return error;
  if (isRecord(error)) return stringField(error, "message") || "youtrack error";
  return "youtrack error";
}

function parseJson(text: string | null): unknown {
  try {
    return JSON.parse(text ?? "");
  } catch {
    return null;
  }
}

function runYt(args: string[], input?: string): YtRun {
  const result = spawnSync("youtrack", [...args, "--json"], { encoding: "utf8", input });
  const stderr = (result.stderr ?? "").trim();
  const data = parseJson(result.stdout) ?? parseJson(stderr);
  const message = jsonErrorMessage(data);
  if (result.status !== 0) return { ok: false, error: message || stderr || `youtrack: exit ${result.status}` };
  if (message) return { ok: false, error: message };
  return { ok: true, data };
}

function toIssue(issue: unknown): YtIssueRow {
  const id = stringField(issue, "idReadable");
  const assignee = customValue(issue, "Assignee");
  return {
    id,
    summary: stringField(issue, "summary"),
    state: customText(issue, "State"),
    assignee: textOf(assignee),
    assigneeLogin: stringField(assignee, "login"),
    priority: customText(issue, "Priority"),
    type: customText(issue, "Type"),
    project: stringField(isRecord(issue) ? issue.project : null, "shortName"),
    updated: millis(isRecord(issue) ? issue.updated : null) ?? 0,
    url: `https://youtrack.realt.by/issue/${id}`,
  };
}

function toSprint(sprint: unknown): YtSprintRow {
  return {
    id: stringField(sprint, "id"),
    name: stringField(sprint, "name"),
    start: millis(isRecord(sprint) ? sprint.start : null),
    finish: millis(isRecord(sprint) ? sprint.finish : null),
    archived: isRecord(sprint) && sprint.archived === true,
  };
}

export function pickCurrentSprint(sprints: YtSprintRow[], now = Date.now()): YtSprintRow | null {
  const visible = sprints.filter((sprint) => !sprint.archived);
  const active = visible.find(
    (sprint) => sprint.start !== null && sprint.finish !== null && sprint.start <= now && now <= sprint.finish,
  );
  if (active) return active;
  let latest: YtSprintRow | null = null;
  for (const sprint of visible) {
    if (sprint.start === null) continue;
    const bestStart = latest?.start ?? null;
    if (bestStart === null || sprint.start > bestStart) latest = sprint;
  }
  return latest;
}

export const youtrackAdapter: YouTrackPort = {
  issueView(id) {
    return yt(["issue", "view", id, "-f", "idReadable,summary,description,customFields(name,value(name))"]);
  },
  issueParents(id) {
    return parseParents(yt(["issue", "link", "list", id]));
  },
  issueSubtaskLinks(id) {
    return parseSubtaskLinks(yt(["issue", "link", "list", id]));
  },
  issues(query, limit) {
    const run = runYt([
      "issue",
      "list",
      "--query",
      query,
      "--limit",
      String(limit),
      "-f",
      "idReadable,summary,updated,project(shortName),customFields(name,value(name,login))",
    ]);
    if (!run.ok) return { ok: false, error: run.error, issues: [] };
    const rows = Array.isArray(run.data) ? run.data : [];
    return { ok: true, issues: rows.map(toIssue) };
  },
  sprints(boardId) {
    const run = runYt(["board", "sprint", "list", "--board", boardId, "-f", "id,name,start,finish,archived"]);
    if (!run.ok) return { ok: false, error: run.error, sprints: [] };
    const rows = Array.isArray(run.data) ? run.data : [];
    return { ok: true, sprints: rows.map(toSprint) };
  },
  users(query, limit): YtUsersResult {
    const args = ["user", "list", "--limit", String(limit), "-f", "login,fullName"];
    if (query.trim()) args.push("--query", query.trim());
    const run = runYt(args);
    if (!run.ok) return { ok: false, error: run.error, users: [] };
    const rows = Array.isArray(run.data) ? run.data : [];
    const users: YtUserRow[] = rows
      .map((row) => ({
        login: stringField(row, "login"),
        name: stringField(row, "fullName") || stringField(row, "login"),
      }))
      .filter((user) => user.login !== "");
    return { ok: true, users };
  },
  createIssue(input): YtCreateIssueResult {
    const create = runYt(
      [
        "issue",
        "create",
        "--project",
        input.project,
        "--summary",
        input.summary,
        "--description-file",
        "-",
        "--parent",
        input.parentId,
        "-f",
        "idReadable",
      ],
      input.description,
    );
    if (!create.ok) return { ok: false, error: create.error, warnings: [] };
    const id = stringField(create.data, "idReadable");
    if (!id) return { ok: false, error: "YouTrack не вернул ID созданной задачи", warnings: [] };
    const warnings: string[] = [];
    const warn = (label: string, run: YtRun) => {
      if (!run.ok) warnings.push(`${label}: ${run.error ?? "ошибка"}`);
    };
    warn("Type", runYt(["issue", "field", "set", id, "Type", input.type]));
    if (input.assignee) warn("Assignee", runYt(["issue", "assign", id, input.assignee]));
    if (input.estimation)
      warn(
        "Estimation",
        runYt(["issue", "field", "set", id, "Estimation", input.estimation, "--type", "period"]),
      );
    return { ok: true, id, url: `https://youtrack.realt.by/issue/${id}`, warnings };
  },
};
