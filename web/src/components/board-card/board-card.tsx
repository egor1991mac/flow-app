import type { YtIssue } from "@/lib/types";
import type { FC } from "react";

interface BoardCardProps {
  issue: YtIssue;
  onCreate?: (id: string) => void;
}

export const BoardCard: FC<BoardCardProps> = ({ issue, onCreate }) => {
  const meta = [issue.assignee, issue.priority, issue.type].filter(Boolean);
  const updated = issue.updated ? new Date(issue.updated).toLocaleDateString("ru-RU") : "";

  return (
    <div className="board-card" title={issue.summary}>
      <a className="board-card-link" href={issue.url} target="_blank" rel="noreferrer">
        <span className="board-card-id">{issue.id}</span>
        <span className="board-card-summary">{issue.summary}</span>
        {meta.length > 0 ? <span className="board-card-meta">{meta.join(" · ")}</span> : null}
        {updated ? <span className="board-card-date">{updated}</span> : null}
      </a>
      {onCreate ? (
        <button
          className="mini"
          title={`Создать ${issue.id} по флоу`}
          onClick={() => onCreate(issue.id)}
        >
          ＋
        </button>
      ) : null}
    </div>
  );
};
