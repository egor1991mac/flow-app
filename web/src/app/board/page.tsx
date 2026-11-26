"use client";

import { useQuery } from "@apollo/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Board } from "@/components/board/board";
import { BoardFilter } from "@/components/board-filter/board-filter";
import { CreateModal } from "@/components/create-modal/create-modal";
import { CreateYtModal } from "@/components/create-yt-modal/create-yt-modal";
import { QUERY_YT_BOARD, QUERY_YT_SPRINTS } from "@/lib/graphql/documents";

import type { BoardColumn } from "@/components/board/board";
import type { YtBoardData, YtIssue, YtSprintsData } from "@/lib/types";
import type { FC } from "react";

const STATE_ORDER = [
  "Open",
  "In Progress",
  "Ready for Review",
  "Ready for Testing",
  "Testing on Dev",
  "Testing on Staging",
  "Deployed",
  "Closed",
];

const LIMIT = 300;

const BoardPage: FC = () => {
  const router = useRouter();
  const { data: sprintsData } = useQuery<YtSprintsData>(QUERY_YT_SPRINTS, {
    fetchPolicy: "cache-and-network",
  });
  const [assigned, setAssigned] = useState(true);
  const [sprintChoice, setSprintChoice] = useState<string | null | undefined>(undefined);
  const [applied, setApplied] = useState("");
  const [createFor, setCreateFor] = useState<string | null>(null);
  const [createYtOpen, setCreateYtOpen] = useState(false);

  const current = sprintsData?.ytSprints.current ?? null;
  const sprints = sprintsData?.ytSprints.sprints ?? [];
  const sprintId = sprintChoice === undefined ? current?.id ?? null : sprintChoice;
  const sprint = sprints.find((item) => item.id === sprintId) ?? null;
  const sprintName = sprint?.name ?? "";

  const query = useMemo(
    () =>
      [assigned ? "assignee: me" : "", sprintName ? `Sprints: {${sprintName}}` : "", applied]
        .filter(Boolean)
        .join(" "),
    [assigned, sprintName, applied]
  );
  const variables = useMemo(() => ({ query, limit: LIMIT }), [query]);

  const { data, loading, error, refetch } = useQuery<
    YtBoardData,
    { query: string; limit: number }
  >(QUERY_YT_BOARD, { variables, fetchPolicy: "cache-and-network", skip: !sprintsData });

  const columns = useMemo<BoardColumn[]>(() => {
    const groups = new Map<string, YtIssue[]>();
    for (const issue of data?.ytBoard.issues ?? []) {
      const list = groups.get(issue.state);
      if (list) {
        list.push(issue);
      } else {
        groups.set(issue.state, [issue]);
      }
    }
    const rest = Array.from(groups.keys())
      .filter((state) => !STATE_ORDER.includes(state))
      .sort((a, b) => a.localeCompare(b, "ru"));
    return [...STATE_ORDER.filter((state) => groups.has(state)), ...rest].map((state) => ({
      state,
      issues: groups.get(state) ?? [],
    }));
  }, [data]);

  const board = data?.ytBoard ?? null;
  const errorText = error?.message ?? (board && !board.ok ? board.error ?? "ошибка запроса" : null);
  const sprintsError =
    sprintsData?.ytSprints.ok === false
      ? sprintsData.ytSprints.error ?? "не удалось получить спринты"
      : null;

  return (
    <>
      <header>
        <h1>борда</h1>
        <span className="sub">YouTrack · Realt</span>
        <button className="primary" onClick={() => setCreateYtOpen(true)}>
          ＋ задача в YouTrack
        </button>
        <BoardFilter
          assigned={assigned}
          onAssignedChange={setAssigned}
          sprintId={sprintId}
          sprints={sprints}
          onSprintChange={setSprintChoice}
          onSearch={setApplied}
        />
        <Link className="nav-link" href="/">
          ← задачи
        </Link>
      </header>
      <main className="board-main">
        {sprintsError ? <div className="msg err">{sprintsError}</div> : null}
        {loading && !board ? (
          <p className="busy">
            <span className="spinner" /> загружаем…
          </p>
        ) : null}
        {errorText ? <div className="msg err">{errorText}</div> : null}
        {board?.truncated ? (
          <div className="msg">показаны первые {LIMIT} задач — уточните запрос</div>
        ) : null}
        {board?.ok && board.issues.length === 0 ? (
          <p className="empty">Ничего не найдено.</p>
        ) : null}
        {columns.length > 0 ? <Board columns={columns} onCreate={setCreateFor} /> : null}
      </main>
      <CreateModal
        open={createFor !== null}
        initialId={createFor}
        onClose={() => setCreateFor(null)}
        onCreated={(id) => {
          setCreateFor(null);
          router.push(`/?task=${encodeURIComponent(id)}`);
          return Promise.resolve();
        }}
      />
      <CreateYtModal
        open={createYtOpen}
        onClose={() => setCreateYtOpen(false)}
        onCreated={() => void refetch()}
      />
    </>
  );
};

export default BoardPage;
