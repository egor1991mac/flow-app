import type { Task } from "@/lib/types";

export const STAGE_DEFS: Array<[string, string]> = [
  ["Готовность окружения", "doctor, доноры, сертификат, docker, VPN"],
  ["Чтение задачи", "поля, тип и описание из YouTrack"],
  ["Основа ветки", "база ветки и структура пространства"],
  ["Рабочие копии", "worktrees и ветки по канону"],
  ["Пространство", "менеджер: Фича → задача → репозитории"],
  ["Техническое задание", "TASK.md и AGENTS.md задачи"],
  ["Стек", "контейнеры, порты, адреса, health"],
  ["Рабочее место", "терминалы, агент, вкладка браузера"],
  ["Работа и диагностика", "orca-env, установка пакетов"],
  ["Слияние в Фичу", "merge, конфликты, перезапуск стека"],
  ["Закрытие", "down, удаление копий, освобождение слота"],
];

export const STAGE_DEFS_SIMPLE: Record<number, [string, string]> = {
  1: ["Чтение задачи", "поля, тип и описание из YouTrack"],
  2: ["Ветка от основы", "ветка задачи в основном клоне"],
  8: ["Работа", "правки в основном клоне, локальный запуск"],
  9: ["Слияние в Фичу", "merge ветки задачи в ветку Фичи"],
  10: ["Закрытие", "запись из реестра; ветка остаётся"],
};

export const STAGE_SETS = {
  worktree: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  simple: [1, 2, 8, 9, 10],
} as const;

export function stageSet(task: Pick<Task, "mode"> | null | undefined): readonly number[] {
  return STAGE_SETS[task?.mode === "simple" ? "simple" : "worktree"];
}

export function stageDef(task: Pick<Task, "mode"> | null | undefined, n: number): [string, string] {
  return (task?.mode === "simple" ? STAGE_DEFS_SIMPLE[n] : undefined) ?? STAGE_DEFS[n];
}

export function shortWords(t: Pick<Task, "titleRu">): string {
  const title = (t.titleRu ?? "")
    .replace(/^[^:]*:\s*/, "")
    .replace(/^(\[[^\]]*\]\s*)+/, "")
    .trim();
  const words = title
    .split(/[\s/]+/)
    .map((w) => w.replace(/^[^А-Яа-яЁё]+|[^А-Яа-яЁё]+$/g, ""))
    .filter((w) => /[А-Яа-яЁё]/.test(w))
    .slice(0, 5);
  if (words.length === 0) return "";
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return words.join(" ");
}

export function displayName(t: Pick<Task, "id" | "type" | "titleRu">): string {
  const w = shortWords(t);
  if (!w) return t.id;
  return t.type === "story" ? `${w}-${t.id}` : `${t.id}-${w}`;
}
