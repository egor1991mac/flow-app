"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import {
  MUTATION_APPROVE_STAGE,
  MUTATION_FINISH_TASK,
  MUTATION_MERGE_TASK,
  MUTATION_SET_STAGE,
  MUTATION_START_TASK,
  QUERY_JOB,
  QUERY_TASK_DETAIL,
} from "@/lib/graphql/documents";
import type { BranchRow, InvokeResult, Job, JournalData, StagesFile, StartResult, Task } from "@/lib/types";
import { stageDef, stageSet } from "@/lib/stages";

interface ActiveJob {
  taskId: string;
  jobId: string;
}

interface DetailProps {
  id: string;
  job: ActiveJob | null;
  onJobEnd: () => void;
  onClosed: (id: string) => void;
  onStart: (id: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

interface TaskDetailData {
  task: Task | null;
  taskStages: StagesFile | null;
  taskJournal: JournalData;
  taskBranches: BranchRow[];
}

interface JobData {
  job: Job | null;
}

interface StageInput {
  id: string;
  n: number;
  status: string;
  report?: string | null;
}

interface ApproveStageInput {
  id: string;
  n: number;
  phrase: string;
}

export function Detail({ id, job, onJobEnd, onClosed, onStart, onRefresh }: DetailProps) {
  const [stageNum, setStageNum] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [phrase, setPhrase] = useState("");
  const [log, setLog] = useState("");

  const activeJobId = job && job.taskId === id ? job.jobId : null;
  const { data, refetch } = useQuery<TaskDetailData>(QUERY_TASK_DETAIL, {
    variables: { id },
    fetchPolicy: "cache-and-network",
  });
  const { data: jobData } = useQuery<JobData>(QUERY_JOB, {
    variables: { id: activeJobId },
    skip: !activeJobId,
    fetchPolicy: "network-only",
    pollInterval: 700,
  });

  const [setStage] = useMutation<{ setStage: InvokeResult }, { input: StageInput }>(MUTATION_SET_STAGE);
  const [approveStage] = useMutation<{ approveStage: InvokeResult }, { input: ApproveStageInput }>(MUTATION_APPROVE_STAGE);
  const [startTask] = useMutation<{ startTask: StartResult }, { id: string; start: boolean }>(MUTATION_START_TASK);
  const [mergeTask] = useMutation<{ mergeTask: InvokeResult }, { id: string; yes?: boolean }>(MUTATION_MERGE_TASK);
  const [finishTask] = useMutation<{ finishTask: InvokeResult }, { id: string; yes?: boolean; dryRun?: boolean }>(MUTATION_FINISH_TASK);

  useEffect(() => {
    setStageNum(null);
    setMsg(null);
    setBusy(false);
    setLog("");
  }, [id]);

  useEffect(() => {
    if (!jobData?.job) return;
    setLog(jobData.job.log);
    if (jobData.job.done) {
      setBusy(false);
      setLog((prev) => prev + `\n— exit ${jobData.job?.code ?? ""} —\n`);
      void refetch();
      onJobEnd();
    }
  }, [jobData, refetch, onJobEnd]);

  const show = (res: InvokeResult) => {
    setMsg({
      ok: res.ok,
      text: res.ok ? res.output.join("\n") : (res.error ?? "ошибка") + "\n" + (res.err ?? []).join("\n"),
    });
    void refetch();
  };

  if (!data) return <p className="empty">загружаю…</p>;
  const task = data.task;
  if (!task) return <p className="empty">задача не найдена</p>;

  const stages = data.taskStages;
  const journal = data.taskJournal;
  const branches = data.taskBranches;
  const set = stageSet(task);
  const stageList = stages?.stages ?? [];
  const current = stageNum ?? (stages?.currentStage !== null && set.includes(stages?.currentStage ?? -1) ? stages?.currentStage : set[0]) ?? set[0];
  const activeStage = stageList.find((s) => s.stage === current);

  const runStage = async (status: string) => {
    const r = await setStage({ variables: { input: { id: task.id, n: current, status, report: "из UI" } } });
    if (r.data) show(r.data.setStage);
  };

  const runApprove = async () => {
    const r = await approveStage({ variables: { input: { id: task.id, n: current, phrase } } });
    if (r.data) show(r.data.approveStage);
  };

  const startClick = async () => {
    if (!confirm(`Запустить окружение ${task.id}? Будут заняты порты, подняты контейнеры.`)) return;
    const res = await startTask({ variables: { id: task.id, start: true } });
    if (!res.data?.startTask.jobId) {
      if (res.data) show(res.data.startTask);
      return;
    }
    await onStart(task.id);
  };

  const mergeClick = async () => {
    if (confirm(`Слить ${task.id} в Фичу ${task.parentId} и остановить стек?`)) {
      const r = await mergeTask({ variables: { id: task.id, yes: true } });
      if (r.data) show(r.data.mergeTask);
    }
  };

  const finishClick = async () => {
    const dry = await finishTask({ variables: { id: task.id, dryRun: true } });
    if (confirm(`Закрыть ${task.id}?\n\n${(dry.data?.finishTask.output ?? []).join("\n")}\n\nГейты требуют подтверждения. Удалить окружение?`)) {
      const r = await finishTask({ variables: { id: task.id, yes: true } });
      const result = r.data?.finishTask;
      if (result?.ok) onClosed(task.id);
      else if (result) show(result);
    }
  };

  const upTitle =
    task.mode === "simple"
      ? "Задача создана в режиме «просто ветка»: окружения нет, Start недоступен"
      : task.status === "active"
        ? `Запустить окружение ${task.id}: слот, порты, env/compose и контейнеры`
        : "Только для активной задачи";
  const mergeTitle = !task.parentId
    ? "У задачи нет Фичи"
    : task.parentExternal
      ? "Фича вне реестра — слияние вручную"
      : task.status !== "active"
        ? "Только для активной задачи"
        : `Влить ${task.id} в ветку Фичи ${task.parentId}`;

  const stageLines = [`этап ${current}: ${activeStage?.status ?? "pending"}`];
  for (const r of activeStage?.runs ?? []) {
    stageLines.push(`run ${r.runId}  ${r.startedAt} → ${r.finishedAt ?? "…"}`);
    if (r.report) stageLines.push(`  ${r.report}`);
  }
  for (const a of activeStage?.approvals ?? []) stageLines.push(`approve ${a.approvedAt} «${a.phrase}» run ${a.runId}`);
  for (const d of (journal.decisions ?? []).filter((x) => x.stage === current)) {
    stageLines.push(`decision ${String(d.ts)} ${String(d.point)}: ${String(d.input)} -> ${String(d.choice)}`);
  }
  if (stageLines.length === 1) stageLines.push("нет данных: этап ещё не выполнялся");

  const approvals = stageList.flatMap((s) => s.approvals ?? []);
  const seenKeys = new Set<string>();
  const uniqueBranches = branches.filter((r) => {
    const k = `${r.branch}|${r.base}`;
    if (seenKeys.has(k)) return false;
    seenKeys.add(k);
    return true;
  });

  const journalLines = [
    ...(journal.decisions ?? []).map((x) => `decision ${String(x.ts)} ${String(x.point)}: ${String(x.input)} -> ${String(x.choice)}`),
    ...(journal.journal ?? []).map((x) => `event ${String(x.ts)} ${String(x.event)} ${x.details ? JSON.stringify(x.details) : ""}`),
  ];

  return (
    <div>
      <h2>{task.titleRu ?? task.id}</h2>
      <div className="meta">
        <span className={`pill ${task.status}`}>{task.status}</span> · {task.type}
        {task.parentId ? <> · Фича {task.parentId}</> : null}
      </div>
      <div className="meta">
        ветка{" "}
        {uniqueBranches.map((r, i) => (
          <span key={r.repo}>
            {i > 0 ? " · " : ""}
            {uniqueBranches.length > 1 ? `${r.repo}: ` : ""}
            {r.url ? (
              <a className="branch-link" href={r.url} target="_blank" rel="noreferrer">
                {r.branch}
              </a>
            ) : (
              <code>{r.branch}</code>
            )}
            {r.base ? (
              <>
                {" от "}
                {r.baseUrl ? (
                  <a className="branch-link" href={r.baseUrl} target="_blank" rel="noreferrer">
                    {r.base}
                  </a>
                ) : (
                  <code>{r.base}</code>
                )}
              </>
            ) : null}
          </span>
        ))}
      </div>
      <div className="meta">{task.workspacePath}</div>

      <h3>Жизненный цикл</h3>
      <div className="actions-panel">
        <div className="action-group">
          <div className="group-title">{task.type === "story" ? "Фича" : "Задача"}</div>
          <div className="group-hint">
            Старт поднимает окружение: слот, порты, env/compose, контейнеры (при создании ничего не запускается). merge вливает
            ветку в Фичу, finish гасит стек и удаляет копии.
          </div>
          <div className="action-row">
            <button className="primary" disabled={task.status !== "active" || task.mode === "simple"} title={upTitle} onClick={() => void startClick()}>
              ▶ Старт
            </button>
            <button disabled={task.status !== "active" || !task.parentId || task.parentExternal} title={mergeTitle} onClick={() => void mergeClick()}>
              merge в Фичу
            </button>
            <button className="danger" disabled={task.status === "closed"} title="Гейты (грязный код, невлитая ветка, дети) требуют подтверждения" onClick={() => void finishClick()}>
              finish: закрыть
            </button>
          </div>
        </div>
      </div>

      <h3>Этапы</h3>
      <div className="stages">
        {set.map((i) => {
          const s = stageList.find((x) => x.stage === i);
          const status = s?.status ?? "pending";
          const [sname, sdesc] = stageDef(task, i);
          return (
            <div
              key={i}
              className={`stage ${status}` + (current === i ? " selected" : "")}
              title={`этап ${i}: ${sname} — ${sdesc} (клик — логи этапа)`}
              onClick={() => setStageNum(i)}
            >
              <div className="n">{i}</div>
              <div className="sname">{sname}</div>
              <div className="sdesc">{sdesc}</div>
              <div className="sstatus">{status}</div>
            </div>
          );
        })}
      </div>
      <p className="hint">
        {task.mode === "simple"
          ? "Режим «просто ветка»: нет worktree, пространства и Docker, поэтому этапы 0, 3, 4, 5, 6, 7 скрыты (в памяти задачи остаются). Работа идёт в основном клоне, закрытие снимает запись из реестра, ветка остаётся."
          : "Старт проходит этапы 6 → 7 последовательно: у выполняющегося этапа крутится лоадер, блок залит цветом статуса. Клик по этапу — его логи и действия. passed — выполнено автоматически, approved — подтверждено вами."}
      </p>

      <div className="stage-actions">
        <div className="action-group stage-action-group">
          <div className="group-title">Этап {current}: {stageDef(task, current)[0]}</div>
          <div className="group-hint">
            running — начали, passed — отчитались, failed — провал и повтор с начала. approve принимает только фразу «этап N ок» и
            только после passed.
          </div>
          <div className="action-row">
            {(["running", "passed", "failed"] as const).map((status) => (
              <button key={status} disabled={busy} title={`Отметить этап ${current} как ${status}`} onClick={() => void runStage(status)}>
                {status}
              </button>
            ))}
            <input placeholder={`этап ${current} ок`} size={14} value={phrase} onChange={(e) => setPhrase(e.target.value)} />
            <button className="primary" disabled={busy} onClick={() => void runApprove()}>
              approve
            </button>
          </div>
        </div>
      </div>

      {busy ? (
        <div className="busy">
          <span className="spinner" /> выполняется…
        </div>
      ) : null}

      <h3>Логи</h3>
      <div className="log">{log || stageLines.join("\n")}</div>

      {approvals.length ? (
        <>
          <h3>Апрувы</h3>
          <table>
            <tbody>
              <tr>
                <th>этап</th>
                <th>кто</th>
                <th>когда</th>
                <th>фраза</th>
                <th>run</th>
              </tr>
              {approvals.map((a, i) => (
                <tr key={i}>
                  <td>{a.stage}</td>
                  <td>{a.approvedBy}</td>
                  <td>{a.approvedAt}</td>
                  <td>{a.phrase}</td>
                  <td>{a.runId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      <h3>Журнал / решения</h3>
      <div className="log">{journalLines.length ? journalLines.join("\n") : "память пуста"}</div>

      {msg ? <div className={`msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div> : null}
      <button className="ghost" onClick={() => void onRefresh()}>
        обновить
      </button>
    </div>
  );
}
