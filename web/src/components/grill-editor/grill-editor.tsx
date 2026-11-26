"use client";

import { useMutation, useQuery } from "@apollo/client";
import { useEffect, useState } from "react";

import { MUTATION_LAUNCH_GRILL, QUERY_YT_GRILL } from "@/lib/graphql/documents";

import type { GrillLaunch, YtGrillData } from "@/lib/types";
import type { FC } from "react";

export interface GrillContext {
  id: string;
  url?: string | null;
  summary?: string | null;
}

export const grillTitle = (markdown: string): string => {
  const match = /^#\s+(.+)$/m.exec(markdown);
  return match ? match[1].trim() : "";
};

interface GrillEditorProps {
  open: boolean;
  slug: string;
  context: GrillContext | null;
  value: string;
  disabled?: boolean;
  autoWatch?: boolean;
  onChange: (value: string) => void;
  onResult: (markdown: string) => void;
}

const grillPrompt = (context: GrillContext, path: string): string =>
  [
    `Выполни скил grill-with-docs (/grill-with-docs, ~/.agents/skills/grill-with-docs/SKILL.md) по задаче ${context.id}${context.url ? ` (${context.url})` : ""}.`,
    context.summary ? `Контекст: ${context.summary}.` : "",
    `Результат сохрани в файл ${path} одним markdown-файлом:`,
    "человеческое описание задачи на 2–4 абзаца, критерии приёмки и mermaid-диаграмму решения.",
    "Этот файл целиком станет описанием подзадачи в YouTrack.",
    "Ничего кроме этого файла в рабочей папке не создавай — CONTEXT.md и ADR не нужны.",
  ]
    .filter(Boolean)
    .join("\n");

export const GrillEditor: FC<GrillEditorProps> = ({
  open,
  slug,
  context,
  value,
  disabled = false,
  autoWatch = true,
  onChange,
  onResult,
}) => {
  const [auto, setAuto] = useState(autoWatch);
  const [manualPrompt, setManualPrompt] = useState("");
  const [hint, setHint] = useState("");

  const { data } = useQuery<YtGrillData, { slug: string }>(QUERY_YT_GRILL, {
    skip: !open || !slug,
    variables: { slug },
    pollInterval: open ? 3000 : 0,
    fetchPolicy: "network-only",
  });
  const [launchGrill, { loading: launching }] = useMutation<
    { launchGrill: GrillLaunch },
    { slug: string; prompt: string }
  >(MUTATION_LAUNCH_GRILL);

  const path = data?.ytGrill.path ?? "";
  const content = data?.ytGrill.content ?? "";

  useEffect(() => {
    if (!open) {
      return;
    }
    setAuto(autoWatch);
    setManualPrompt("");
    setHint("");
  }, [open, slug, autoWatch]);

  useEffect(() => {
    if (!content || !auto) {
      return;
    }
    onResult(content);
  }, [content, auto]);

  const copy = async () => {
    if (!context || !path) {
      return;
    }
    const prompt = grillPrompt(context, path);
    try {
      await navigator.clipboard.writeText(prompt);
      setManualPrompt("");
      setHint("промпт скопирован — вставь его в агента");
    } catch {
      setManualPrompt(prompt);
      setHint("буфер недоступен — скопируй промпт вручную");
    }
  };

  const launch = async () => {
    if (!context || !path) {
      return;
    }
    const prompt = grillPrompt(context, path);
    try {
      const res = await launchGrill({ variables: { slug, prompt } });
      const result = res.data?.launchGrill;
      if (result?.ok) {
        setManualPrompt("");
        setHint(`opencode-чат открыт в Orca · ${result.path}`);
      } else {
        setHint("не удалось открыть агента: " + (result?.error ?? ""));
      }
    } catch (e) {
      setHint("ошибка запуска: " + String((e as Error).message ?? e));
    }
  };

  return (
    <>
      <div className="grill-box">
        <button
          className={launching ? "primary loading" : "primary"}
          disabled={disabled || !context || !path || launching}
          onClick={() => void launch()}
        >
          grill-me-withdocs
        </button>
        <button className="mini" disabled={disabled || !context || !path} onClick={() => void copy()}>
          копировать
        </button>
        <span className="field-note">открыть opencode-чат в Orca с контекстом и путём результата</span>
        <code className="grill-path">{path || "путь появится после открытия модалки"}</code>
        {content ? <span className="grill-state">результат агента найден</span> : null}
        {hint ? <span className="field-note">{hint}</span> : null}
      </div>
      {manualPrompt ? <textarea className="grill-manual" readOnly value={manualPrompt} /> : null}
      <textarea
        className="md-editor"
        value={value}
        disabled={disabled}
        placeholder="# Заголовок&#10;&#10;человеческое описание и mermaid-диаграмма из грилинга"
        onChange={(e) => {
          setAuto(false);
          onChange(e.target.value);
        }}
      />
      <span className="field-note">
        {auto
          ? "автообновление из файла агента включено"
          : "ручной режим — «подхватить» вернёт результат агента"}
        <button
          className="mini"
          disabled={disabled || !content}
          onClick={() => {
            setAuto(true);
            if (content) {
              onResult(content);
            }
          }}
        >
          подхватить
        </button>
      </span>
    </>
  );
};
