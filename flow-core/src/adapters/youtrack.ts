import { spawnSync } from "node:child_process";
import type { YouTrackPort } from "../ports.ts";

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
};
