import { useState } from "react";

import type { YtSprint } from "@/lib/types";
import type { ChangeEvent, FC, FormEvent } from "react";

interface BoardFilterProps {
  assigned: boolean;
  onAssignedChange: (assigned: boolean) => void;
  sprintId: string | null;
  sprints: YtSprint[];
  onSprintChange: (sprintId: string | null) => void;
  onSearch: (text: string) => void;
}

export const BoardFilter: FC<BoardFilterProps> = ({
  assigned,
  onAssignedChange,
  sprintId,
  sprints,
  onSprintChange,
  onSearch,
}) => {
  const [text, setText] = useState("");

  const selectSprint = (event: ChangeEvent<HTMLSelectElement>) => {
    onSprintChange(event.target.value || null);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch(text.trim());
  };

  return (
    <form className="board-filter" onSubmit={submit}>
      <button
        type="button"
        className={assigned ? "primary" : ""}
        onClick={() => onAssignedChange(!assigned)}
      >
        Мои
      </button>
      <select value={sprintId ?? ""} onChange={selectSprint}>
        <option value="">все спринты</option>
        {sprints.map((sprint) => (
          <option key={sprint.id} value={sprint.id}>
            {sprint.name}
          </option>
        ))}
      </select>
      <input
        value={text}
        placeholder="запрос YouTrack, Enter…"
        onChange={(event) => setText(event.target.value)}
      />
    </form>
  );
};
