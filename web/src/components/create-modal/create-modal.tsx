"use client";

import { useApolloClient, useLazyQuery, useMutation, useQuery } from "@apollo/client";
import { useEffect, useRef, useState } from "react";

import {
  MUTATION_CREATE_TASK,
  MUTATION_SWITCH_TASK,
  QUERY_BRANCH_NAMES,
  QUERY_CONFIG,
  QUERY_INTAKE,
  QUERY_TASK,
} from "@/lib/graphql/documents";

import type { AppConfig, IntakeResponse, InvokeResult, Task } from "@/lib/types";
import type { FC } from "react";

interface CreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => Promise<void>;
}

interface CreateTaskInput {
  id: string;
  type: string;
  repos: string;
  parentId?: string | null;
  summary?: string | null;
  description?: string | null;
  fromBranch?: string | null;
  fromBase?: boolean | null;
}

interface SwitchTaskInput {
  id: string;
  repos: string;
  type?: string | null;
  summary?: string | null;
  description?: string | null;
  parentId?: string | null;
  from?: string | null;
}

export const CreateModal: FC<CreateModalProps> = ({ open, onClose, onCreated }) => {
  const ref = useRef<HTMLDialogElement | null>(null);
  const client = useApolloClient();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<"worktree" | "switch">("worktree");
  const [link, setLink] = useState("");
  const [id, setId] = useState("");
  const [type, setType] = useState("task");
  const [summary, setSummary] = useState("");
  const [desc, setDesc] = useState("");
  const [parentId, setParentId] = useState("");
  const [base, setBase] = useState("");
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const [msg, setMsg] = useState("");

  const { data: configData } = useQuery<{ config: AppConfig }>(QUERY_CONFIG, { skip: !open });
  const parentForBase = /^[A-Z]+-\d+$/i.test(parentId.trim()) ? parentId.trim() : null;
  const { data: branchesData } = useQuery<{ branchNames: string[] }, { parentId: string | null }>(
    QUERY_BRANCH_NAMES,
    {
      skip: !open,
      variables: { parentId: parentForBase },
    }
  );
  const [loadIntake] = useLazyQuery<{ intake: IntakeResponse }, { input: string }>(QUERY_INTAKE, {
    fetchPolicy: "network-only",
  });
  const [createMutation] = useMutation<{ createTask: InvokeResult }, { input: CreateTaskInput }>(
    MUTATION_CREATE_TASK
  );
  const [switchMutation] = useMutation<{ switchTask: InvokeResult }, { input: SwitchTaskInput }>(
    MUTATION_SWITCH_TASK
  );

  const config = configData?.config ?? null;
  const branches = branchesData?.branchNames ?? [];

  useEffect(() => {
    if (!open) {
      return;
    }
    ref.current?.showModal();
  }, [open]);

  useEffect(() => {
    if (!config || Object.keys(checked).length > 0) {
      return;
    }
    const first = config.repos.www ? "www" : Object.keys(config.repos)[0];
    setChecked({ [first]: true });
  }, [config, checked]);

  const close = () => {
    ref.current?.close();
    onClose();
  };

  const toggleRepo = (repo: string, pair: string | null) => {
    setChecked((prev) => {
      const next = { ...prev, [repo]: !prev[repo] };
      if (mode === "worktree" && pair) {
        if (next[repo]) {
          next[pair] = true;
        } else {
          const stillNeeded = Object.entries(next).some(
            ([r, on]) => on && config?.repos[r]?.pair === pair
          );
          if (!stillNeeded) {
            next[pair] = false;
          }
        }
      }
      return next;
    });
  };

  const defaultBaseFromParent = async (parent: string) => {
    if (!parent) {
      return;
    }
    try {
      const t = await client.query<{ task: Task | null }>({
        query: QUERY_TASK,
        variables: { id: parent },
        fetchPolicy: "network-only",
      });
      if (t.data.task?.branch) {
        setBase(t.data.task.branch);
      }
    } catch {}
  };

  const loadFromYouTrack = async () => {
    if (!link.trim()) {
      setMsg("вставь ссылку на задачу YouTrack");
      return;
    }
    setLoading(true);
    setLocked(true);
    setMsg("читаю задачу…");
    try {
      const r = (await loadIntake({ variables: { input: link.trim() } })).data?.intake;
      if (!r || !r.ok) {
        setMsg("ошибка: " + (r?.error ?? "не удалось прочитать задачу"));
        return;
      }
      setId(r.id ?? "");
      setType(r.type ?? "task");
      setSummary(r.summary ?? "");
      setDesc(r.description ?? "");
      setParentId(r.parentId ?? "");
      setMsg(
        `заполнено из YouTrack: ${r.id ?? ""} · ${r.ytType ?? "тип не задан"} · ${r.state ?? ""}` +
          (r.parentSource ? ` · Фича: ${r.parentId} (${r.parentSource})` : "") +
          (r.parentError ? ` · ${r.parentError}` : "")
      );
      await defaultBaseFromParent(r.parentId ?? "");
    } catch (e) {
      setMsg("ошибка связи с сервером: " + String((e as Error).message ?? e));
    } finally {
      setLoading(false);
      setLocked(false);
    }
  };

  const create = async () => {
    const repos = Object.entries(checked)
      .filter(([, on]) => on)
      .map(([r]) => r)
      .join(",");
    if (!repos) {
      setMsg("выбери хотя бы один репозиторий");
      return;
    }
    if (mode === "switch") {
      setMsg("создаю ветку и переключаю проект…");
      const res = await switchMutation({
        variables: {
          input: {
            id,
            type,
            summary,
            description: desc,
            parentId: parentId.trim() || null,
            from: base.trim(),
            repos,
          },
        },
      });
      const result = res.data?.switchTask;
      setMsg(
        result?.ok ? "готово: " + result.output.join("; ") : "ошибка: " + (result?.error ?? "")
      );
      if (result?.ok) {
        await onCreated(id);
        setTimeout(close, 800);
      }
      return;
    }
    if (!id.trim()) {
      setMsg("укажи ID задачи");
      return;
    }
    setMsg("создание…");
    const res = await createMutation({
      variables: {
        input: {
          id: id.trim(),
          type,
          repos,
          parentId: parentId.trim() || null,
          summary,
          description: desc,
          fromBranch: base.trim() || null,
        },
      },
    });
    const result = res.data?.createTask;
    if (result?.ok) {
      await onCreated(id.trim());
      close();
    } else {
      setMsg("ошибка: " + (result?.error ?? ""));
    }
  };

  return (
    <dialog
      ref={ref}
      className="modal"
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          close();
        }
      }}
    >
      <div className="modal-head">
        <h2>Новая задача</h2>
        <button className="ghost" onClick={close}>
          ✕
        </button>
      </div>
      <div className="modal-grid">
        <label className="wide">
          <span className="form-title">Ссылка на YouTrack</span>
          <span className="inline-row">
            <input
              value={link}
              placeholder="https://youtrack.realt.by/issue/REALT-…"
              disabled={locked}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void loadFromYouTrack();
                }
              }}
            />
            <button
              className={loading ? "loading" : ""}
              disabled={loading}
              onClick={() => void loadFromYouTrack()}
            >
              Загрузить
            </button>
          </span>
        </label>
        <label>
          <span className="form-title">ID</span>
          <input value={id} disabled={locked} onChange={(e) => setId(e.target.value)} />
        </label>
        <label>
          <span className="form-title">Тип</span>
          <select value={type} disabled={locked} onChange={(e) => setType(e.target.value)}>
            <option value="task">task</option>
            <option value="bug">bug</option>
            <option value="story">story</option>
          </select>
        </label>
        <label className="wide">
          <span className="form-title">Название</span>
          <input value={summary} disabled={locked} onChange={(e) => setSummary(e.target.value)} />
        </label>
        <label className="wide">
          <span className="form-title">Описание</span>
          <textarea value={desc} disabled={locked} onChange={(e) => setDesc(e.target.value)} />
        </label>
        <label>
          <span className="form-title">Фича (parentId)</span>
          <input
            value={parentId}
            disabled={locked}
            onChange={(e) => {
              setParentId(e.target.value);
              void defaultBaseFromParent(e.target.value.trim());
            }}
          />
        </label>
        <label>
          <span className="form-title">Режим</span>
          <select
            value={mode}
            disabled={locked}
            onChange={(e) => {
              const m = e.target.value as "worktree" | "switch";
              setMode(m);
              setMsg(
                m === "switch"
                  ? "создастся ветка задачи от основы и переключится основной клон — без worktree, окружения и Docker"
                  : ""
              );
            }}
          >
            <option value="worktree">worktree: копии + Docker по кнопке</option>
            <option value="switch">просто ветка в основном клоне</option>
          </select>
        </label>
        <label className="wide">
          <span className="form-title">Основа: от какой ветки отвести</span>
          <input
            list="nf-branches"
            value={base}
            disabled={locked}
            onChange={(e) => setBase(e.target.value)}
          />
          <datalist id="nf-branches">
            {branches.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
          <span className="field-note">
            пусто → ветка Фичи, иначе stage; если основы нет в репозитории — фолбэк на stage с
            предупреждением
          </span>
        </label>
        <label className="wide">
          <span className="form-title">Репозитории</span>
          <span className="repo-list">
            {Object.entries(config?.repos ?? {}).map(([repo, cfg]) => (
              <label key={repo}>
                <input
                  type="checkbox"
                  checked={!!checked[repo]}
                  disabled={locked}
                  onChange={() => toggleRepo(repo, cfg.pair)}
                />
                {repo}
              </label>
            ))}
          </span>
          <span className="field-note">
            {mode === "worktree"
              ? "пары ui→api подхватываются автоматически"
              : "пары не добавляются: только отмеченные"}
          </span>
        </label>
      </div>
      <div className="modal-actions">
        <span className="sub">{msg}</span>
        <button onClick={close}>Отмена</button>
        <button className="primary" disabled={locked} onClick={() => void create()}>
          Создать
        </button>
      </div>
    </dialog>
  );
};
