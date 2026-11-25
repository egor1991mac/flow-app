import fs from "node:fs";
import path from "node:path";
import { readRegistry, initStages, writeStages, stagesPath, appendJsonl, nowIso, nextId } from "../src/store.ts";

const HOME = process.env.ORCA_FLOW_HOME ?? path.join(process.env.HOME, "orca/workspaces/all-projects");
const META = path.join(HOME, ".orca-flow");
const dry = process.argv.includes("--dry-run");
const registry = readRegistry(META);

let create = 0;
let skip = 0;
for (const task of Object.values(registry.tasks)) {
  const ws = task.workspacePath;
  if (!ws || !fs.existsSync(ws)) {
    skip++;
    continue;
  }
  const file = stagesPath(ws);
  if (fs.existsSync(file)) {
    skip++;
    continue;
  }
  create++;
  console.log(`${dry ? "would create" : "create"} ${task.id} (${task.status}) -> ${file}`);
  if (!dry) {
    writeStages(file, initStages("task", task.id));
    appendJsonl(path.join(ws, ".flow", "journal.jsonl"), {
      id: nextId(),
      ts: nowIso(),
      event: "created",
      details: { backfill: true, status: task.status, note: "история до миграции недоступна; этапы сброшены в pending" },
    });
  }
}
console.log(`\nbackfill: ${create} to create, ${skip} skipped (no workspace or memory exists)${dry ? " [dry-run]" : ""}`);
