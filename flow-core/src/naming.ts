import type { TaskType } from "./types.ts";

const TRANSLIT: Record<string, string> = {
  А: "a", а: "a", Б: "b", б: "b", В: "v", в: "v", Г: "g", г: "g", Д: "d", д: "d",
  Е: "e", е: "e", Ё: "yo", ё: "yo", Ж: "zh", ж: "zh", З: "z", з: "z", И: "i", и: "i",
  Й: "y", й: "y", К: "k", к: "k", Л: "l", л: "l", М: "m", м: "m", Н: "n", н: "n",
  О: "o", о: "o", П: "p", п: "p", Р: "r", р: "r", С: "s", с: "s", Т: "t", т: "t",
  У: "u", у: "u", Ф: "f", ф: "f", Х: "kh", х: "kh", Ц: "ts", ц: "ts", Ч: "ch", ч: "ch",
  Ш: "sh", ш: "sh", Щ: "shch", щ: "shch", Ъ: "", ъ: "", Ы: "y", ы: "y", Ь: "", ь: "",
  Э: "e", э: "e", Ю: "yu", ю: "yu", Я: "ya", я: "ya",
};

const STOP_WORDS = new Set(["i", "v", "na", "dlya", "s", "po", "the", "a", "and", "of"]);
const SLUG_MAX = 45;

function transliterate(s: string): string {
  let out = "";
  for (const ch of s) out += TRANSLIT[ch] ?? ch;
  return out;
}

export function slugify(summary: string): string {
  if (!summary.replace(/\s/g, "")) return "";
  const normalized = transliterate(summary)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
  const kept = normalized.split("-").filter((w) => w && !STOP_WORDS.has(w));
  let acc = "";
  for (const word of kept) {
    const candidate = acc ? `${acc}-${word}` : word;
    if (candidate.length <= SLUG_MAX) {
      acc = candidate;
    } else if (acc === "") {
      acc = word.slice(0, SLUG_MAX);
      break;
    } else {
      break;
    }
  }
  return acc;
}

export function cleanSummary(summary: string): string {
  const cleaned = summary.replace(/^(\[[^\]]*\]\s*[-–—:]?\s*)+/, "");
  return cleaned.replace(/\s/g, "") ? cleaned : summary;
}

export function branchName(id: string, type: TaskType, summary: string): string {
  const slug = slugify(summary);
  const base = slug ? `${id}-${slug}` : id;
  return type === "story" ? `feature-${base}` : base;
}

export function dockerProject(branch: string): string {
  return branch.replace(/^feature-/, "").toLowerCase();
}
