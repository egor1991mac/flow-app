"use client";

import { useMutation } from "@apollo/client";
import { useState } from "react";

import { MUTATION_FINISH_TASK, MUTATION_START_TASK } from "@/lib/graphql/documents";
import { displayName } from "@/lib/stages";

import type { InvokeResult, StartResult, Task } from "@/lib/types";
import type { FC, MouseEvent } from "react";

interface TreeProps {
  tasks: Task[];
  selected: string | null;
  onSelect: (id: string) => void;
  onStart: (id: string) => void;
  onFinish: (id: string) => void;
}

export const Tree: FC<TreeProps> = ({ tasks, selected, onSelect, onStart, onFinish }) => {
  const [showClosed, setShowClosed] = useState(true);
  const [startMutation] = useMutation<{ startTask: StartResult }, { id: string; start: boolean }>(
    MUTATION_START_TASK
  );
  const [finishMutation] = useMutation<
    { finishTask: InvokeResult },
    { id: string; yes?: boolean; dryRun?: boolean }
  >(MUTATION_FINISH_TASK);

  const open = tasks.filter((t) => t.status !== "closed");
  const closed = tasks.filter((t) => t.status === "closed");
  const byId = Object.fromEntries(open.map((t) => [t.id, t]));
  const roots = open.filter((t) => t.type === "story");
  const childIds = new Set<string>();
  for (const t of open) {
    const parent = t.parentId ? byId[t.parentId] : undefined;
    if (parent?.type === "story") {
      childIds.add(t.id);
    }
  }
  for (const t of open) {
    if (t.type !== "story" && !childIds.has(t.id)) {
      roots.push(t);
    }
  }

  const start = async (e: MouseEvent, t: Task) => {
    e.stopPropagation();
    if (!confirm(`Запустить окружение ${t.id}?`)) {
      return;
    }
    const res = await startMutation({ variables: { id: t.id, start: true } });
    const result = res.data?.startTask;
    if (!result?.jobId) {
      alert(result?.error ?? "не удалось запустить");
      return;
    }
    onStart(t.id);
  };

  const finish = async (e: MouseEvent, t: Task) => {
    e.stopPropagation();
    const dry = await finishMutation({ variables: { id: t.id, dryRun: true } });
    const text = (dry.data?.finishTask.output ?? []).join("\n");
    if (!confirm(`Закрыть ${t.id}?\n\n${text}\n\nУдалить локальное окружение?`)) {
      return;
    }
    const r = await finishMutation({ variables: { id: t.id, yes: true } });
    if (!r.data?.finishTask.ok) {
      alert(r.data?.finishTask.error ?? "не удалось закрыть");
      return;
    }
    onFinish(t.id);
  };

  const node = (t: Task) => (
    <div
      key={t.id}
      className={`node type-${t.type} status-${t.status}` + (selected === t.id ? " active" : "")}
      title={t.titleRu ?? t.id}
      onClick={() => onSelect(t.id)}
    >
      <span className="node-name">{displayName(t)}</span>
      <span className={`status status-${t.status}`}>{t.status}</span>
      <div className="node-controls">
        <button
          className="mini"
          title="Старт: поднять окружение"
          disabled={t.status !== "active" || t.mode === "simple"}
          onClick={(e) => void start(e, t)}
        >
          ▶
        </button>
        <button
          className="mini danger"
          title="Закрыть: погасить стек и удалить копии"
          disabled={t.status === "closed"}
          onClick={(e) => void finish(e, t)}
        >
          ✕
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="group-title">Открытые ({open.length})</div>
      {roots.map((f) => (
        <div key={f.id}>
          {node(f)}
          {f.type === "story" && (
            <div className="children">
              {open.filter((t) => t.parentId === f.id).map((k) => node(k))}
            </div>
          )}
        </div>
      ))}

      {closed.length > 0 ? (
        <div className="tree-closed">
          <button
            className="group-title tree-toggle"
            title={showClosed ? "Скрыть закрытые задачи" : "Показать закрытые задачи"}
            onClick={() => setShowClosed((v) => !v)}
          >
            {showClosed ? "▾" : "▸"} Закрытые ({closed.length})
          </button>
          {showClosed ? closed.map((t) => node(t)) : null}
        </div>
      ) : null}
    </>
  );
};
