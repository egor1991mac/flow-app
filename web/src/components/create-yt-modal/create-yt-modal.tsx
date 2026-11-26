"use client";

import { useLazyQuery, useMutation, useQuery } from "@apollo/client";
import { useEffect, useRef, useState } from "react";

import { GrillEditor, grillTitle } from "@/components/grill-editor/grill-editor";
import { MUTATION_YT_CREATE_ISSUE, QUERY_YT_BOARD, QUERY_YT_USERS } from "@/lib/graphql/documents";

import type { YtBoardData, YtCreated, YtIssue, YtUsersData } from "@/lib/types";
import type { FC } from "react";

interface CreateYtModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const STORY_ID = /\/(?:issue|agiles\/[^/]+\/issue)\/([A-Za-z][A-Za-z0-9]*-[0-9]+)/;
const PLAIN_ID = /^([A-Za-z][A-Za-z0-9]*-[0-9]+)$/;

const storyQuery = (input: string): string => {
  const trimmed = input.trim();
  const match = STORY_ID.exec(trimmed) ?? PLAIN_ID.exec(trimmed);
  return match ? match[1].toUpperCase() : `Type: Story ${trimmed}`;
};

export const CreateYtModal: FC<CreateYtModalProps> = ({ open, onClose, onCreated }) => {
  const ref = useRef<HTMLDialogElement | null>(null);
  const [slug, setSlug] = useState("");
  const [search, setSearch] = useState("");
  const [searched, setSearched] = useState(false);
  const [story, setStory] = useState<YtIssue | null>(null);
  const [summary, setSummary] = useState("");
  const [desc, setDesc] = useState("");
  const [assignee, setAssignee] = useState("");
  const [estimation, setEstimation] = useState("");
  const [created, setCreated] = useState<YtCreated | null>(null);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: usersData } = useQuery<YtUsersData>(QUERY_YT_USERS, {
    skip: !open,
    variables: { limit: 200 },
  });
  const [loadStories, { data: storyData, loading: storyLoading }] = useLazyQuery<
    YtBoardData,
    { query: string; limit: number }
  >(QUERY_YT_BOARD, { fetchPolicy: "network-only" });
  const [createIssue] = useMutation<{ ytCreateIssue: YtCreated }, { input: unknown }>(
    MUTATION_YT_CREATE_ISSUE
  );

  const users = usersData?.ytUsers.users ?? [];
  const stories = storyData?.ytBoard.issues ?? [];
  const storyError = storyData?.ytBoard.error ?? null;

  useEffect(() => {
    if (!open) {
      return;
    }
    ref.current?.showModal();
    setSlug(`yt-${Date.now().toString(36)}`);
  }, [open]);

  const reset = () => {
    setSearch("");
    setSearched(false);
    setStory(null);
    setSummary("");
    setDesc("");
    setAssignee("");
    setEstimation("");
    setCreated(null);
    setMsg("");
    setSaving(false);
  };

  const close = () => {
    ref.current?.close();
    reset();
    onClose();
  };

  const searchStories = (input = search) => {
    if (!input.trim()) {
      setMsg("вставь ссылку на стори или введи текст для поиска");
      return;
    }
    setMsg("");
    void loadStories({ variables: { query: storyQuery(input), limit: 20 } });
    setSearched(true);
  };

  const pick = (issue: YtIssue) => {
    setStory(issue);
    setMsg("");
  };

  const create = async () => {
    if (!story) {
      setMsg("выбери стори");
      return;
    }
    if (!summary.trim()) {
      setMsg("укажи название");
      return;
    }
    setSaving(true);
    setMsg("создаю…");
    try {
      const res = await createIssue({
        variables: {
          input: {
            summary: summary.trim(),
            description: desc,
            parentId: story.id,
            assignee: assignee.trim() || null,
            estimation: estimation.trim() || null,
          },
        },
      });
      const result = res.data?.ytCreateIssue;
      if (!result) {
        setMsg("ошибка: пустой ответ сервера");
        return;
      }
      if (!result.ok) {
        setMsg("ошибка: " + (result.error ?? ""));
        return;
      }
      setCreated(result);
      setMsg(result.warnings.length > 0 ? result.warnings.join("; ") : "");
      onCreated();
    } catch (e) {
      setMsg("ошибка связи с сервером: " + String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={ref}
      className="modal yt-modal"
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          close();
        }
      }}
    >
      <div className="modal-head">
        <h2>Задача в YouTrack</h2>
        <button className="ghost" onClick={close}>
          ✕
        </button>
      </div>
      <div className="modal-grid">
        <div className="wide story-picker">
          <label>
            <span className="form-title">Стори: ссылка или совпадение</span>
            <input
              value={search}
              placeholder="https://youtrack.realt.by/issue/REALT-… или «лендинг мта»"
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  searchStories();
                }
              }}
            />
          </label>
          <button className={storyLoading ? "loading" : ""} disabled={storyLoading} onClick={() => searchStories()}>
            Найти
          </button>
        </div>
        {storyError ? <div className="msg err wide">{storyError}</div> : null}
        {story ? (
          <div className="wide selected-story">
            <span className="story-row-id">{story.id}</span>
            <span className="board-card-summary">{story.summary}</span>
            <button className="mini" onClick={() => setStory(null)}>
              сменить
            </button>
          </div>
        ) : null}
        {!story && searched && stories.length > 0 ? (
          <div className="wide story-results">
            {stories.map((issue) => {
              const isStory = issue.type === "Story";
              return (
                <button
                  key={issue.id}
                  className="story-row"
                  disabled={!isStory}
                  title={isStory ? issue.summary : `${issue.id}: ${issue.type || "без типа"} — не Story`}
                  onClick={() => pick(issue)}
                >
                  <span className="story-row-id">{issue.id}</span>
                  <span className="board-card-summary">{issue.summary}</span>
                  <span className="story-row-type">{issue.type || "без типа"}</span>
                </button>
              );
            })}
          </div>
        ) : null}
        {!story && searched && !storyLoading && stories.length === 0 ? (
          <div className="wide empty">Ничего не найдено.</div>
        ) : null}
        <label>
          <span className="form-title">Кого засайнить</span>
          <input
            list="yt-users"
            value={assignee}
            placeholder="login"
            onChange={(e) => setAssignee(e.target.value)}
          />
          <datalist id="yt-users">
            {users.map((user) => (
              <option key={user.login} value={user.login}>
                {user.name}
              </option>
            ))}
          </datalist>
        </label>
        <label>
          <span className="form-title">Оценка по времени</span>
          <input
            value={estimation}
            placeholder="например 2h 30m"
            onChange={(e) => setEstimation(e.target.value)}
          />
        </label>
        <label className="wide">
          <span className="form-title">Название</span>
          <input value={summary} onChange={(e) => setSummary(e.target.value)} />
        </label>
        <label className="wide">
          <span className="form-title">Описание в markdown — смотрит на результат агента</span>
          <GrillEditor
            open={open}
            slug={slug}
            context={story ? { id: story.id, url: story.url, summary: story.summary } : null}
            value={desc}
            onChange={setDesc}
            onResult={(markdown) => {
              setDesc(markdown);
              setSummary((prev) => prev || grillTitle(markdown));
            }}
          />
        </label>
      </div>
      <div className="modal-actions">
        <span className="sub">{msg}</span>
        {created ? (
          <>
            <a className="nav-link" href={created.url ?? "#"} target="_blank" rel="noreferrer">
              открыть {created.id}
            </a>
            <button className="primary" onClick={close}>
              Закрыть
            </button>
          </>
        ) : (
          <>
            <button onClick={close}>Отмена</button>
            <button className="primary" disabled={saving} onClick={() => void create()}>
              Создать подзадачу
            </button>
          </>
        )}
      </div>
    </dialog>
  );
};
