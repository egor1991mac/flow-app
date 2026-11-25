import fs from "node:fs";
import path from "node:path";
import type { Task } from "./types.ts";

export function repoWebUrl(remote: string | null): string | null {
  if (!remote) return null;
  const m = /^(?:git@|ssh:\/\/git@|https?:\/\/)([^:/]+)[:/](.+)$/.exec(remote.trim());
  if (!m) return null;
  return `https://${m[1]}/${m[2].replace(/\.git$/, "")}`;
}

export function writeSpec(ws: string, task: Task, refresh = false): void {
  const file = path.join(ws, "TASK.md");
  const desc = task.description ?? "";
  if (!desc.replace(/\s/g, "")) return;
  if (fs.existsSync(file) && !refresh) return;
  const body = `# ${task.titleRu}\n\n> Задача: https://youtrack.realt.by/issue/${task.id}\n> Ветка: \`${task.branch}\`\n\n${desc}\n`;
  fs.writeFileSync(file, body);
}

export function writeAgents(ws: string, task: Task, feature: Task | null): void {
  const file = path.join(ws, "AGENTS.md");
  const endpoints = Object.entries(task.endpoints);
  const lines: string[] = [];
  lines.push("<!-- orca-flow:start -->");
  lines.push(`# ${task.titleRu}`, "");
  lines.push(`- Тип: ${task.type}`);
  lines.push(`- Задача: https://youtrack.realt.by/issue/${task.id}`);
  lines.push(`- Ветка: \`${task.branch}\``);
  lines.push(`- Workspace: \`${ws}\``);
  lines.push(`- Реестр: \`flow state show ${task.id}\``, "");
  if (task.parentId) {
    lines.push("## Фича", "");
    if (task.parentExternal || !feature) lines.push(`- \`${task.parentId}\` вне реестра: мерж вручную.`);
    else lines.push(`- \`${feature.id}\`, ветка \`${feature.branch}\`, папка \`${feature.workspacePath}\``);
    lines.push("");
  }
  lines.push("## Репозитории", "", "| Репозиторий | Ветка | Путь |", "|---|---|---|");
  for (const r of task.repos) lines.push(`| ${r} | \`${task.branch}\` | \`${ws}/${r}\` |`);
  lines.push("", "## Адреса", "");
  if (endpoints.length === 0) lines.push(`Стек ещё не поднимался: \`flow up ${task.id}\`.`);
  else for (const [r, u] of endpoints) lines.push(`- ${r}: ${u}`);
  lines.push("", "## ТЗ", "", "Полное ТЗ задачи: `./TASK.md`.", "");
  lines.push("<!-- orca-flow:end -->");
  const block = lines.join("\n");
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, block + "\n");
  } else if (fs.readFileSync(file, "utf8").includes("<!-- orca-flow:start -->")) {
    const cur = fs.readFileSync(file, "utf8");
    const replaced = cur.replace(/<!-- orca-flow:start -->[\s\S]*?<!-- orca-flow:end -->/, block);
    fs.writeFileSync(file, replaced);
  } else {
    fs.appendFileSync(file, "\n" + block + "\n");
  }
}
