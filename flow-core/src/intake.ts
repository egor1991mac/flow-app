import type { TaskType } from "./types.ts";

export function intakeId(input: string): string | null {
  const url = /\/issue\/([A-Za-z][A-Za-z0-9]*-[0-9]+)/.exec(input);
  if (url) return url[1]!.toUpperCase();
  const plain = /^([A-Za-z][A-Za-z0-9]*-[0-9]+)$/.exec(input.trim());
  if (plain) return plain[1]!.toUpperCase();
  return null;
}

export function typeKind(ytType: string): TaskType | null {
  if (ytType === "Story" || ytType === "Epic") return "story";
  if (ytType === "Task") return "task";
  if (ytType === "Bug") return "bug";
  return null;
}

export type TypeDecision = { accept: true; warning?: string } | { accept: false; mismatch: true; ytKind: TaskType | null };

export function typeDecision(requested: TaskType, ytType: string): TypeDecision {
  if (!ytType || ytType === "No type") return { accept: true, warning: `Type is not set in YouTrack, using ${requested}` };
  const kind = typeKind(ytType);
  if (kind === requested) return { accept: true };
  return { accept: false, mismatch: true, ytKind: kind };
}

export function descriptionOk(description: string): boolean {
  return description.replace(/\s/g, "").length >= 10;
}

export function parentDecision(parents: string[]): { parentId: string | null } | { error: string } {
  if (parents.length === 0) return { parentId: null };
  if (parents.length > 1) return { error: `has multiple parents: ${parents.join(", ")}` };
  return { parentId: parents[0]! };
}
