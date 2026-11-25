import fs from "node:fs";
import path from "node:path";
import { META } from "./flow-api.ts";
import type { Registry, JournalEvent, Decision } from "../../../flow-core/src/types.ts";

const DIM = 256;
const STORE = path.join(META, "vector.jsonl");

interface MemoryRecord {
  id: string;
  taskId: string;
  kind: "task" | "journal" | "decision" | "stage";
  text: string;
  ts: string | null;
}

interface StoredRecord extends MemoryRecord {
  vec: number[];
}

export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// shortcut: локальный хеш-эмбеддер без модели, поиск — по совпадению слов и пар; заменить на внешний эмбеддер, когда нужна настоящая семантика
export function embed(text: string): number[] {
  const v = new Float64Array(DIM);
  const words = (text.toLowerCase().match(/[a-zа-яё0-9]+/g) ?? []).slice(0, 512);
  for (let i = 0; i < words.length; i++) {
    v[fnv1a(words[i]) % DIM] += 1;
    if (i + 1 < words.length) v[fnv1a(`${words[i]} ${words[i + 1]}`) % DIM] += 0.5;
  }
  let norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  if (norm === 0) norm = 1;
  return Array.from(v, (x) => x / norm);
}

function cosine(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function recordId(rec: MemoryRecord): string {
  return `${rec.taskId}:${rec.kind}:${fnv1a(rec.text).toString(36)}`;
}

function readJsonl(file: string): string[] {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
}

function collect(): MemoryRecord[] {
  const reg = JSON.parse(fs.readFileSync(path.join(META, "state.json"), "utf8")) as Registry;
  const records: MemoryRecord[] = [];
  for (const task of Object.values(reg.tasks)) {
    records.push({
      id: "",
      taskId: task.id,
      kind: "task",
      text: `${task.titleRu}. ${task.description ?? ""}`,
      ts: task.createdAt,
    });
    const flow = path.join(task.workspacePath, ".flow");
    if (!fs.existsSync(flow)) continue;
    const journal = readJsonl(path.join(flow, "journal.jsonl"));
    for (const line of journal.slice(-200)) {
      try {
        const ev = JSON.parse(line) as JournalEvent;
        records.push({
          id: "",
          taskId: task.id,
          kind: "journal",
          text: `${ev.event} ${ev.details ? JSON.stringify(ev.details) : ""}`.trim(),
          ts: ev.ts ?? null,
        });
      } catch {}
    }
    const decisions = readJsonl(path.join(flow, "decisions.jsonl"));
    for (const line of decisions.slice(-200)) {
      try {
        const d = JSON.parse(line) as Decision;
        records.push({
          id: "",
          taskId: task.id,
          kind: "decision",
          text: `${d.point}: ${d.input} -> ${d.choice}`,
          ts: d.ts ?? null,
        });
      } catch {}
    }
    const stagesFile = path.join(flow, "stages.json");
    if (fs.existsSync(stagesFile)) {
      const stages = JSON.parse(fs.readFileSync(stagesFile, "utf8"));
      for (const s of stages.stages ?? []) {
        for (const run of s.runs ?? []) {
          if (!run.report) continue;
          records.push({
            id: "",
            taskId: task.id,
            kind: "stage",
            text: `этап ${s.stage}: ${run.report}`,
            ts: run.startedAt ?? null,
          });
        }
      }
    }
  }
  for (const rec of records) rec.id = recordId(rec);
  return records;
}

function loadStore(): Map<string, StoredRecord> {
  const map = new Map<string, StoredRecord>();
  if (!fs.existsSync(STORE)) return map;
  for (const line of fs.readFileSync(STORE, "utf8").split("\n").filter(Boolean)) {
    try {
      const rec = JSON.parse(line) as StoredRecord;
      map.set(rec.id, rec);
    } catch {}
  }
  return map;
}

function syncIndex(): Map<string, StoredRecord> {
  const store = loadStore();
  const records = collect();
  const live = new Set(records.map((r) => r.id));
  let changed = false;
  for (const rec of records) {
    if (store.has(rec.id)) continue;
    store.set(rec.id, { ...rec, vec: embed(rec.text) });
    changed = true;
  }
  for (const id of [...store.keys()]) {
    if (!live.has(id)) {
      store.delete(id);
      changed = true;
    }
  }
  if (changed) {
    fs.mkdirSync(path.dirname(STORE), { recursive: true });
    fs.writeFileSync(STORE, [...store.values()].map((r) => JSON.stringify(r)).join("\n") + "\n");
  }
  return store;
}

export function indexedCount(): number {
  return syncIndex().size;
}

export interface SearchHit {
  taskId: string;
  kind: string;
  snippet: string;
  score: number;
  ts: string | null;
}

export function searchMemory(query: string, k = 8): SearchHit[] {
  if (!query.trim()) return [];
  const store = syncIndex();
  const q = embed(query);
  const hits: SearchHit[] = [];
  for (const rec of store.values()) {
    const score = cosine(q, rec.vec);
    if (score <= 0.02) continue;
    hits.push({
      taskId: rec.taskId,
      kind: rec.kind,
      snippet: rec.text.length > 220 ? rec.text.slice(0, 220) + "…" : rec.text,
      score,
      ts: rec.ts,
    });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, k);
}
