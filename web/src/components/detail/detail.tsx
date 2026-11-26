"use client";

import { useMutation, useQuery } from "@apollo/client";
import { useEffect, useState } from "react";

import {
  MUTATION_APPROVE_STAGE,
  MUTATION_COMMIT_TASK,
  MUTATION_CREATE_TASK_MR,
  MUTATION_FINISH_TASK,
  MUTATION_LAUNCH_AGENT,
  MUTATION_MERGE_TASK,
  MUTATION_SET_STAGE,
  MUTATION_START_TASK,
  QUERY_JOB,
  QUERY_TASK_DETAIL,
  QUERY_TASK_GIT,
} from "@/lib/graphql/documents";
import { stageDef, stageSet } from "@/lib/stages";

import type {
  BranchRow,
  InvokeResult,
  Job,
  JournalData,
  RepoGitRow,
  StagesFile,
  StartResult,
  Task,
} from "@/lib/types";
import type { FC } from "react";

const COMMIT_TYPES = ["feat", "fix", "refactor", "docs", "test", "chore", "perf", "style"];

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
  onEdit: (id: string) => void;
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

interface GitData {
  taskGit: RepoGitRow[];
}

interface CommitForm {
  repo: string;
  type: string;
  subject: string;
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

export const Detail: FC<DetailProps> = ({
  id,
  job,
  onJobEnd,
  onClosed,
  onStart,
  onRefresh,
  onEdit,
}) => {
  const [stageNum, setStageNum] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [phrase, setPhrase] = useState("");
  const [log, setLog] = useState("");
  const [commitForm, setCommitForm] = useState<CommitForm | null>(null);

  const activeJobId = job && job.taskId === id ? job.jobId : null;
  const { data, refetch } = useQuery<TaskDetailData>(QUERY_TASK_DETAIL, {
    variables: { id },
    fetchPolicy: "cache-and-network",
  });
  const { data: gitData, refetch: refetchGit } = useQuery<GitData>(QUERY_TASK_GIT, {
    variables: { id },
    fetchPolicy: "cache-and-network",
  });
  const { data: jobData } = useQuery<JobData>(QUERY_JOB, {
    variables: { id: activeJobId },
    skip: !activeJobId,
    fetchPolicy: "network-only",
    pollInterval: 700,
  });

  const [setStage] = useMutation<{ setStage: InvokeResult }, { input: StageInput }>(
    MUTATION_SET_STAGE
  );
  const [approveStage] = useMutation<{ approveStage: InvokeResult }, { input: ApproveStageInput }>(
    MUTATION_APPROVE_STAGE
  );
  const [startTask] = useMutation<{ startTask: StartResult }, { id: string; start: boolean }>(
    MUTATION_START_TASK
  );
  const [mergeTask] = useMutation<{ mergeTask: InvokeResult }, { id: string; yes?: boolean }>(
    MUTATION_MERGE_TASK
  );
  const [finishTask] = useMutation<
    { finishTask: InvokeResult },
    { id: string; yes?: boolean; dryRun?: boolean }
  >(MUTATION_FINISH_TASK);
  const [launchAgent] = useMutation<{ launchAgent: InvokeResult }, { id: string }>(
    MUTATION_LAUNCH_AGENT
  );
  const [commitTask] = useMutation<
    { commitTask: InvokeResult },
    { id: string; subject?: string | null; type?: string | null; repo?: string | null }
  >(MUTATION_COMMIT_TASK);
  const [createTaskMr] = useMutation<
    { createTaskMr: InvokeResult },
    { id: string; repo?: string | null }
  >(MUTATION_CREATE_TASK_MR);

  useEffect(() => {
    setStageNum(null);
    setMsg(null);
    setBusy(false);
    setPending(null);
    setLog("");
    setCommitForm(null);
  }, [id]);

  useEffect(() => {
    if (!jobData?.job) {
      return;
    }
    setLog(jobData.job.log);
    if (jobData.job.done) {
      setBusy(false);
      setLog((prev) => prev + `\n— exit ${jobData.job?.code ?? ""} —\n`);
      void refetch();
      onJobEnd();
    }
  }, [jobData, refetch, onJobEnd]);

  const run = async (label: string, action: () => Promise<void>) => {
    setPending(label);
    try {
      await action();
    } finally {
      setPending(null);
    }
  };

  const show = (res: InvokeResult) => {
    setMsg({
      ok: res.ok,
      text: res.ok
        ? res.output.join("\n")
        : (res.error ?? "ошибка") + "\n" + (res.err ?? []).join("\n"),
    });
    void refetch();
    void refetchGit();
  };

  if (!data) {
    return <p className="empty">загружаю…</p>;
  }
  const task = data.task;
  if (!task) {
    return <p className="empty">задача не найдена</p>;
  }

  const stages = data.taskStages;
  const journal = data.taskJournal;
  const branches = data.taskBranches;
  const gitRows = gitData?.taskGit ?? [];
  const set = stageSet(task);
  const stageList = stages?.stages ?? [];

  const getCurrentStage = (): number => {
    if (stageNum !== null) {
      return stageNum;
    }
    const stage = stages?.currentStage;
    if (typeof stage === "number" && set.includes(stage)) {
      return stage;
    }
    return set[0];
  };

  const current = getCurrentStage();
  const activeStage = stageList.find((s) => s.stage === current);

  const runStage = async (status: string) => {
    const r = await setStage({
      variables: { input: { id: task.id, n: current, status, report: "из UI" } },
    });
    if (r.data) {
      show(r.data.setStage);
    }
  };

  const runApprove = async () => {
    const r = await approveStage({ variables: { input: { id: task.id, n: current, phrase } } });
    if (r.data) {
      show(r.data.approveStage);
    }
  };

  const startClick = async () => {
    if (!confirm(`Запустить окружение ${task.id}? Будут заняты порты, подняты контейнеры.`)) {
      return;
    }
    const res = await startTask({ variables: { id: task.id, start: true } });
    if (!res.data?.startTask.jobId) {
      if (res.data) {
        show(res.data.startTask);
      }
      return;
    }
    await onStart(task.id);
  };

  const agentClick = async () => {
    const r = await launchAgent({ variables: { id: task.id } });
    if (r.data) {
      show(r.data.launchAgent);
    }
  };

  const openCommit = (repo: string) => {
    const title = task.titleRu.replace(/^[A-Z]+-\d+\s*[:\u2014-]\s*/, "");
    setCommitForm({
      repo,
      type: task.type === "bug" ? "fix" : "feat",
      subject: title.slice(0, 64),
    });
  };

  const submitCommit = async () => {
    if (!commitForm || !commitForm.subject.trim()) {
      return;
    }
    const r = await commitTask({
      variables: {
        id: task.id,
        repo: commitForm.repo,
        type: commitForm.type,
        subject: commitForm.subject.trim(),
      },
    });
    if (r.data) {
      show(r.data.commitTask);
      setCommitForm(null);
    }
  };

  const createMr = async (repo: string) => {
    if (!confirm(`Отправить ветку и создать MR для ${repo} (${task.id})?`)) {
      return;
    }
    const r = await createTaskMr({ variables: { id: task.id, repo } });
    if (r.data) {
      show(r.data.createTaskMr);
    }
  };

  const mergeClick = async () => {
    if (confirm(`Слить ${task.id} в Фичу ${task.parentId} и остановить стек?`)) {
      const r = await mergeTask({ variables: { id: task.id, yes: true } });
      if (r.data) {
        show(r.data.mergeTask);
      }
    }
  };

  const finishClick = async () => {
    const dry = await finishTask({ variables: { id: task.id, dryRun: true } });
    if (
      confirm(
        `Закрыть ${task.id}?\n\n${(dry.data?.finishTask.output ?? []).join(
          "\n"
        )}\n\nГейты требуют подтверждения. Удалить окружение?`
      )
    ) {
      const r = await finishTask({ variables: { id: task.id, yes: true } });
      const result = r.data?.finishTask;
      if (result?.ok) {
        onClosed(task.id);
      } else if (result) {
        show(result);
      }
    }
  };

  const getStartHint = (): string => {
    if (task.mode === "simple") {
      return "Задача создана в режиме «просто ветка»: окружения нет, Start недоступен";
    }
    if (task.status !== "active") {
      return "Только для активной задачи";
    }
    return `Запустить окружение ${task.id}: слот, порты, env/compose и контейнеры`;
  };

  const getAgentHint = (): string => {
    if (task.status === "closed") {
      return "Задача закрыта: рабочей копии нет";
    }
    return `Запустить opencode по сессии на каждый репозиторий задачи (${task.repos.join(", ")}): AGENTS.md, TASK.md, flow recall и ссылки на ветки; если чат там уже есть, новый не создаётся`;
  };

  const getMergeHint = (): string => {
    if (!task.parentId) {
      return "У задачи нет Фичи";
    }
    if (task.parentExternal) {
      return "Фича вне реестра — слияние вручную";
    }
    if (task.status !== "active") {
      return "Только для активной задачи";
    }
    return `Влить ${task.id} в ветку Фичи ${task.parentId}`;
  };

  const stageLines = [`этап ${current}: ${activeStage?.status ?? "pending"}`];
  for (const r of activeStage?.runs ?? []) {
    stageLines.push(`run ${r.runId}  ${r.startedAt} → ${r.finishedAt ?? "…"}`);
    if (r.report) {
      stageLines.push(`  ${r.report}`);
    }
  }
  for (const a of activeStage?.approvals ?? []) {
    stageLines.push(`approve ${a.approvedAt} «${a.phrase}» run ${a.runId}`);
  }
  for (const d of (journal.decisions ?? []).filter((x) => x.stage === current)) {
    stageLines.push(
      `decision ${String(d.ts)} ${String(d.point)}: ${String(d.input)} -> ${String(d.choice)}`
    );
  }
  if (stageLines.length === 1) {
    stageLines.push("нет данных: этап ещё не выполнялся");
  }

  const approvals = stageList.flatMap((s) => s.approvals ?? []);
  const seenKeys = new Set<string>();
  const uniqueBranches = branches.filter((r) => {
    const k = `${r.branch}|${r.base}`;
    if (seenKeys.has(k)) {
      return false;
    }
    seenKeys.add(k);
    return true;
  });

  const journalLines = [
    ...(journal.decisions ?? []).map(
      (x) =>
        `decision ${String(x.ts)} ${String(x.point)}: ${String(x.input)} -> ${String(x.choice)}`
    ),
    ...(journal.journal ?? []).map(
      (x) =>
        `event ${String(x.ts)} ${String(x.event)} ${x.details ? JSON.stringify(x.details) : ""}`
    ),
  ];

  const gitPending = pending === "коммит" || pending === "MR";

  const branchRef = (name: string, url: string | null) =>
    url ? (
      <a className="branch-link" href={url} target="_blank" rel="noreferrer">
        {name}
      </a>
    ) : (
      <code>{name}</code>
    );

  return (
    <>
      <div className="detail-main">
        <div className="detail-title">
          <h2>{task.titleRu ?? task.id}</h2>
          <button
            className="mini"
            title={`Редактировать ${task.id}: название и описание`}
            onClick={() => onEdit(task.id)}
          >
            ✎ редактировать
          </button>
        </div>
        <div className="meta">
          <span className={`pill ${task.status}`}>{task.status}</span> · {task.type}
          {task.parentId ? <> · Фича {task.parentId}</> : null}
        </div>
        <div className="meta">{task.workspacePath}</div>

        <h3>Описание</h3>
        {task.description ? (
          <div className="description">{task.description}</div>
        ) : (
          <p className="hint">описания нет</p>
        )}

        <h3>Жизненный цикл</h3>
        <div className="actions-panel">
          <div className="action-group">
            <div className="group-title">{task.type === "story" ? "Фича" : "Задача"}</div>
            <div className="group-hint">
              Старт поднимает окружение: слот, порты, env/compose, контейнеры (при создании ничего
              не запускается). merge вливает ветку в Фичу, finish гасит стек и удаляет копии.
              Коммиты и MR — в блоке справа.
            </div>
            <div className="action-row">
              <button
                className="primary"
                disabled={pending !== null || task.status !== "active" || task.mode === "simple"}
                title={getStartHint()}
                onClick={() => void run("старт", startClick)}
              >
                ▶ Старт
              </button>
              <button
                disabled={pending !== null || task.status === "closed"}
                title={getAgentHint()}
                onClick={() => void run("запуск агента", agentClick)}
              >
                Запустить агента
              </button>
              <button
                disabled={
                  pending !== null ||
                  task.status !== "active" ||
                  !task.parentId ||
                  task.parentExternal
                }
                title={getMergeHint()}
                onClick={() => void run("merge", mergeClick)}
              >
                merge в Фичу
              </button>
              <button
                className="danger"
                disabled={pending !== null || task.status === "closed"}
                title="Гейты (грязный код, невлитая ветка, дети) требуют подтверждения"
                onClick={() => void run("finish", finishClick)}
              >
                finish: закрыть
              </button>
            </div>
            {pending && !gitPending ? (
              <div className="run-status">
                <span className="spinner" /> {pending}…
              </div>
            ) : null}
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
            <div className="group-title">
              Этап {current}: {stageDef(task, current)[0]}
            </div>
            <div className="group-hint">
              running — начали, passed — отчитались, failed — провал и повтор с начала. approve
              принимает только фразу «этап N ок» и только после passed.
            </div>
            <div className="action-row">
              {(["running", "passed", "failed"] as const).map((status) => (
                <button
                  key={status}
                  disabled={pending !== null || busy}
                  title={`Отметить этап ${current} как ${status}`}
                  onClick={() => void run("этап", () => runStage(status))}
                >
                  {status}
                </button>
              ))}
              <input
                placeholder={`этап ${current} ок`}
                size={14}
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
              />
              <button
                className="primary"
                disabled={pending !== null || busy}
                onClick={() => void run("approve", runApprove)}
              >
                approve
              </button>
            </div>
            {pending ? (
              <div className="run-status">
                <span className="spinner" /> {pending}…
              </div>
            ) : null}
          </div>
        </div>

        {busy ? (
          <div className="busy">
            <span className="spinner" /> выполняется…
          </div>
        ) : null}

        {msg ? <div className={`msg ${msg.ok ? "ok" : "err"}`}>{msg.text}</div> : null}
        <button className="ghost" onClick={() => void onRefresh()}>
          обновить
        </button>
      </div>

      <div className="detail-side">
        <h3>Коммиты</h3>
        <div className="action-group">
          {gitData ? null : <p className="hint">загружаю…</p>}
          {gitRows.map((row) => (
            <div className="git-repo" key={row.repo}>
              <div className="git-repo-head">
                <span className="git-repo-name">{row.repo}</span>
                <button
                  className="mini"
                  disabled={pending !== null || task.status === "closed"}
                  title={`Добавить коммит в ${row.repo}`}
                  onClick={() => openCommit(row.repo)}
                >
                  + коммит
                </button>
              </div>
              {commitForm?.repo === row.repo ? (
                <div className="commit-form">
                  <div className="action-row">
                    <select
                      value={commitForm.type}
                      aria-label="тип коммита"
                      onChange={(e) => setCommitForm({ ...commitForm, type: e.target.value })}
                    >
                      {COMMIT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <input
                      value={commitForm.subject}
                      placeholder="тема коммита"
                      aria-label="тема коммита"
                      onChange={(e) => setCommitForm({ ...commitForm, subject: e.target.value })}
                    />
                  </div>
                  <div className="action-row">
                    <button
                      className="primary"
                      disabled={pending !== null || !commitForm.subject.trim()}
                      onClick={() => void run("коммит", submitCommit)}
                    >
                      закоммитить
                    </button>
                    <button className="ghost" onClick={() => setCommitForm(null)}>
                      отмена
                    </button>
                  </div>
                </div>
              ) : null}
              {row.commits.length ? (
                <ul className="commit-list">
                  {row.commits.map((c) => (
                    <li key={c.hash} title={`${c.author}, ${c.date}`}>
                      <code>{c.hash}</code> {c.subject}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="hint">
                  {row.base ? `нет коммитов от ${row.base}` : "коммитов нет"}
                </p>
              )}
            </div>
          ))}
          {gitPending ? (
            <div className="run-status">
              <span className="spinner" /> {pending}…
            </div>
          ) : null}
        </div>

        <h3>MR</h3>
        <div className="action-group">
          {gitRows.map((row) => (
            <div className="git-repo" key={row.repo}>
              <div className="git-repo-head">
                <span className="git-repo-name">{row.repo}</span>
                <button
                  className="mini"
                  disabled={pending !== null || task.status === "closed"}
                  title={`Push ветки и MR для ${row.repo}`}
                  onClick={() => void run("MR", () => createMr(row.repo))}
                >
                  + MR
                </button>
              </div>
              {row.mrs.length ? (
                <ul className="commit-list">
                  {row.mrs.map((mr) => (
                    <li key={mr.iid}>
                      {mr.url ? (
                        <a className="git-link" href={mr.url} target="_blank" rel="noreferrer">
                          !{mr.iid} {mr.title}
                        </a>
                      ) : (
                        <span>
                          !{mr.iid} {mr.title}
                        </span>
                      )}
                      <span className="mr-state">
                        {mr.state} → {mr.targetBranch}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="hint">MR нет</p>
              )}
            </div>
          ))}
          {uniqueBranches.length ? (
            <div className="meta">
              ветка{" "}
              {uniqueBranches.map((r, i) => (
                <span key={r.repo}>
                  {i > 0 ? " · " : ""}
                  {uniqueBranches.length > 1 ? `${r.repo}: ` : ""}
                  {branchRef(r.branch, r.url)}
                  {r.base ? (
                    <>
                      {" от "}
                      {branchRef(r.base, r.baseUrl)}
                    </>
                  ) : null}
                </span>
              ))}
            </div>
          ) : null}
        </div>

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
      </div>
    </>
  );
};
