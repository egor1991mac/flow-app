"use client";

import { useMutation } from "@apollo/client";
import type { InvokeResult, StartResult, Task } from "@/lib/types";
import { displayName } from "@/lib/stages";
import { MUTATION_FINISH_TASK, MUTATION_START_TASK } from "@/lib/graphql/documents";

interface TreeProps {
  tasks: Task[];
  selected: string | null;
  onSelect: (id: string) => void;
  onStart: (id: string) => void;
  onFinish: (id: string) => void;
}

export function Tree({ tasks, selected, onSelect, onStart, onFinish }: TreeProps) {
  const [startMutation] = useMutation<{ startTask: StartResult }, { id: string; start: boolean }>(MUTATION_START_TASK);
  const [finishMutation] = useMutation<{ finishTask: InvokeResult }, { id: string; yes?: boolean; dryRun?: boolean }>(MUTATION_FINISH_TASK);

  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const features = tasks.filter((t) => t.type === "story");
  const roots = [...features];
  const childIds = new Set<string>();
  for (const t of tasks) {
    if (t.parentId && byId[t.parentId] && byId[t.parentId]!.type === "story") childIds.add(t.id);
  }
  for (const t of tasks) if (t.type !== "story" && !childIds.has(t.id)) roots.push(t);

  const start = async (e: React.MouseEvent, t: Task) => {
    e.stopPropagation();
    if (!confirm(`Запустить окружение ${t.id}?`)) return;
    const res = await startMutation({ variables: { id: t.id, start: true } });
    const result = res.data?.startTask;
    if (!result?.jobId) {
      alert(result?.error ?? "не удалось запустить");
      return;
    }
    onStart(t.id);
  };

  const finish = async (e: React.MouseEvent, t: Task) => {
    e.stopPropagation();
    const dry = await finishMutation({ variables: { id: t.id, dryRun: true } });
    const text = (dry.data?.finishTask.output ?? []).join("\n");
    if (!confirm(`Закрыть ${t.id}?\n\n${text}\n\nУдалить локальное окружение?`)) return;
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
      {roots.map((f) => (
        <div key={f.id}>
          {node(f)}
          {f.type === "story" && (
            <div className="children">
              {tasks
                .filter((t) => t.parentId === f.id)
                .map((k) => node(k))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
