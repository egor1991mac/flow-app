import fs from "node:fs";
import path from "node:path";
import type { Registry, Config, StagesFile, Scope, Stage, Decision, JournalEvent } from "./types.ts";
import { APPROVAL_PHRASE, STAGE_STATUSES } from "./types.ts";

export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

let seq = 0;
export function nextId(): string {
  seq += 1;
  return `${nowIso()}-${process.pid}-${seq}`;
}

export function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

export function writeJsonAtomic(file: string, data: unknown): void {
  const tmp = `${file}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`);
  fs.renameSync(tmp, file);
}

export function lock(metaDir: string): void {
  const dir = path.join(metaDir, "state.lock");
  try {
    fs.mkdirSync(dir);
  } catch {
    throw new Error(`state is locked by another run: ${dir}`);
  }
}

export function unlock(metaDir: string): void {
  fs.rmSync(path.join(metaDir, "state.lock"), { recursive: true, force: true });
}

export function readRegistry(metaDir: string): Registry {
  return readJson<Registry>(path.join(metaDir, "state.json"));
}

export function readConfig(metaDir: string): Config {
  return readJson<Config>(path.join(metaDir, "config.json"));
}

export function stagesPath(ws: string): string {
  return path.join(ws, ".flow", "stages.json");
}

export function globalStagesPath(metaDir: string): string {
  return path.join(metaDir, "stages-global.json");
}

export function readStages(file: string): StagesFile | null {
  return fs.existsSync(file) ? readJson<StagesFile>(file) : null;
}

export function initStages(scope: Scope, taskId: string | null): StagesFile {
  const nums = scope === "global" ? [0] : Array.from({ length: 11 }, (_, i) => i);
  const stages: Stage[] = nums.map((stage) => ({ stage, status: "pending", runs: [], approvals: [] }));
  return { version: 1, scope, taskId: scope === "global" ? null : taskId, currentStage: null, stages };
}

export function writeStages(file: string, data: StagesFile): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeJsonAtomic(file, data);
}

export function appendJsonl(file: string, record: Decision | JournalEvent): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(record) + "\n");
}

export function validateStages(data: StagesFile): string[] {
  const errors: string[] = [];
  const nums = data.stages.map((s) => s.stage);
  if (data.scope === "global") {
    if (data.taskId !== null) errors.push("global: taskId must be null");
    if (nums.length !== 1 || nums[0] !== 0) errors.push("global: exactly stage 0");
  } else {
    if (data.taskId === null) errors.push("task: taskId must be set");
    if (new Set(nums).size !== nums.length) errors.push("task: duplicate stage numbers");
    for (let i = 0; i <= 10; i++) if (!nums.includes(i)) errors.push(`task: missing stage ${i}`);
  }
  if (data.currentStage !== null && (data.currentStage < 0 || data.currentStage > 10)) {
    errors.push("currentStage out of range");
  }
  for (const s of data.stages) {
    if (!STAGE_STATUSES.includes(s.status)) errors.push(`stage ${s.stage}: bad status ${s.status}`);
    const runIds = new Set(s.runs.map((r) => r.runId));
    for (const a of s.approvals) {
      if (a.approvedBy !== "user") errors.push(`stage ${s.stage}: approvedBy must be user`);
      if (!APPROVAL_PHRASE.test(a.phrase)) errors.push(`stage ${s.stage}: non-canonical phrase`);
      const m = /^\s*[Ээ][Тт][Аа][Пп]\s+(10|[0-9])\s+/.exec(a.phrase);
      const phraseN = m ? Number(m[1]) : NaN;
      if (phraseN !== a.stage || a.stage !== s.stage) errors.push(`stage ${s.stage}: phrase number mismatch`);
      if (!runIds.has(a.runId)) errors.push(`stage ${s.stage}: approval runId not in runs`);
    }
  }
  return errors;
}
