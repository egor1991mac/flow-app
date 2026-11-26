import { BoardCard } from "@/components/board-card/board-card";

import type { YtIssue } from "@/lib/types";
import type { FC } from "react";

const NO_CREATE_STATES = ["Ready for Review", "Closed", "Backlog"];

export interface BoardColumn {
  state: string;
  issues: YtIssue[];
}interface BoardProps {
  columns: BoardColumn[];
  onCreate: (id: string) => void;
}

export const Board: FC<BoardProps> = ({ columns, onCreate }) => (
  <div className="board">
    {columns.map((column) => (
      <section className="board-column" key={column.state}>
        <h3>
          {column.state || "без статуса"}
          <span className="board-count">{column.issues.length}</span>
        </h3>
        <div className="board-cards">
          {column.issues.map((issue) => (
            <BoardCard
              key={issue.id}
              issue={issue}
              onCreate={NO_CREATE_STATES.includes(column.state) ? undefined : onCreate}
            />
          ))}
        </div>
      </section>
    ))}
  </div>
);
