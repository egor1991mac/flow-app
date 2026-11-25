import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { slugify } from "../src/naming.ts";
import { resolveRepos } from "../src/repos.ts";
import { normalizeRef } from "../src/base.ts";
import { renderCompose, writeEnv } from "../src/stack.ts";
import { intakeId } from "../src/intake.ts";
import { canTransition } from "../src/gates.ts";

const HOME = process.env.ORCA_FLOW_HOME ?? path.join(process.env.HOME, "orca/workspaces/all-projects");
const META = path.join(HOME, ".orca-flow");
const LIB = path.join(process.env.HOME, "orca/workspaces/docker-worktree/orca-flow/lib");
const TPL = path.join(META, "templates/docker-compose.tpl.yml");
const reg = JSON.parse(fs.readFileSync(path.join(META, "state.json"), "utf8"));
const cfg = JSON.parse(fs.readFileSync(path.join(META, "config.json"), "utf8"));
const tpl = fs.readFileSync(TPL, "utf8");

function bash(fn, lib, args, env) {
  const src = lib.map((l) => `source "${LIB}/${l}"`).join("; ");
  const r = spawnSync("bash", ["-c", `${src}; ${fn} "$@"`, "_", ...args], { encoding: "utf8", env: { ...process.env, ...env } });
  return r.stdout.replace(/\n$/, "");
}

let diffs = 0;
const check = (label, a, b) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    diffs++;
    console.log(`DIFF ${label}\n  bash=${JSON.stringify(a)}\n  core=${JSON.stringify(b)}`);
  }
};

const summaries = Object.values(reg.tasks).map((t) => t.titleRu.replace(/^[^:]*:\s*/, ""));
const slugEdges = ["", "   ", "Ёлка и щука", "Ъ ь э ю я", "[MLS] [bug] - добавить кнопку", "the a and of i v na dlya s po", "очень-длинное-слово-которое-точно-больше-сорока-пяти-символов-и-даже-больше"];
for (const s of [...summaries, ...slugEdges]) check(`slug ${JSON.stringify(s)}`, bash("of_slugify", ["slug.sh"], [s]), slugify(s));

for (const inp of ["www", "admin", "mls", "www,admin", "bff", "www bff", "mls;admin", "www,www"]) {
  const b = bash("of_resolve_repos", ["common.sh", "repos.sh"], [inp], { ORCA_FLOW_HOME: HOME }).split("\n").filter(Boolean);
  check(`repos ${JSON.stringify(inp)}`, b, resolveRepos(inp, cfg));
}

for (const r of ["origin/stage", "stage", "https://gitlab.realt.by/mls/www/-/tree/feature-x", "https://gitlab.realt.by/mls/www/tree/feature-x", "feature-y/", "origin/feature-z"]) {
  check(`normalizeRef ${JSON.stringify(r)}`, bash("of_normalize_ref", ["worktree.sh"], [r]), normalizeRef(r));
}

const tmp = path.join(process.env.TMPDIR ?? "/tmp", `flow-parity-render-${process.pid}.yml`);
for (const set of ["www bff", "bff", "admin bff-admin", "mls bff-mls", "www bff admin bff-admin mls bff-mls", "www"]) {
  bash("of_render_compose", ["compose.sh"], [TPL, set, tmp]);
  check(`render ${set}`, fs.readFileSync(tmp, "utf8"), renderCompose(tpl, set.split(" ")));
}
fs.rmSync(tmp, { force: true });

for (const s of ["https://youtrack.realt.by/issue/REALT-12068", "REALT-12068", "realt-12068", "https://youtrack.realt.by/issue/REALT-12068#focus", "garbage", "", "REALT-12068-extra"]) {
  check(`intakeId ${JSON.stringify(s)}`, bash("of_intake_id", ["intake.sh"], [s]), intakeId(s) ?? "");
}

for (const t of Object.values(reg.tasks)) {
  if (t.slot === null || !fs.existsSync(path.join(t.workspacePath, ".env"))) continue;
  check(`env ${t.id}`, fs.readFileSync(path.join(t.workspacePath, ".env"), "utf8"), writeEnv(t.id, t.workspacePath, t.dockerProject, t.repos, cfg, t.slot));
}

const allowed = [["pending", "running"], ["failed", "running"], ["running", "passed"], ["running", "failed"], ["passed", "failed"]];
const all = ["pending", "running", "passed", "failed", "approved"];
for (const a of all) for (const b of all) {
  const exp = a === b || allowed.some(([x, y]) => x === a && y === b);
  if (canTransition(a, b) !== exp) { diffs++; console.log(`DIFF transition ${a}->${b}`); }
}

console.log(diffs === 0 ? "PARITY PASS: diff = 0 (bash == core)" : `PARITY FAIL: ${diffs} diffs`);
process.exit(diffs === 0 ? 0 : 1);
