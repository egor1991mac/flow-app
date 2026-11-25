"use client";

import { useState } from "react";
import { useLazyQuery } from "@apollo/client";
import { QUERY_SEARCH } from "@/lib/graphql/documents";
import type { SearchResponse } from "@/lib/types";

interface MemorySearchProps {
  onSelect: (taskId: string) => void;
}

export function MemorySearch({ onSelect }: MemorySearchProps) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<SearchResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [runSearch] = useLazyQuery<{ search: SearchResponse }, { q: string }>(QUERY_SEARCH, { fetchPolicy: "network-only" });

  const run = async () => {
    if (!q.trim()) {
      setRes(null);
      setOpen(false);
      return;
    }
    const r = await runSearch({ variables: { q: q.trim() } });
    setRes(r.data?.search ?? null);
    setOpen(true);
  };

  return (
    <div className="search">
      <input
        value={q}
        placeholder="поиск по памяти задач (ветор)…"
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void run();
        }}
      />
      <button className={open ? "" : "primary"} onClick={() => void run()}>
        найти
      </button>
      {open && res ? (
        <div className="search-results">
          <div className="search-meta">
            найдено {res.results.length} · индекс {res.indexed} записей
            <button className="ghost" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
          {res.results.length === 0 ? <div className="search-hit">ничего не нашлось</div> : null}
          {res.results.map((h, i) => (
            <div
              key={i}
              className="search-hit"
              onClick={() => {
                setOpen(false);
                onSelect(h.taskId);
              }}
            >
              <span className="pill active">{h.taskId}</span>
              <span className="kind">{h.kind}</span>
              <span className="score">{(h.score * 100).toFixed(0)}%</span>
              <div className="snippet">{h.snippet}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
