"use client";

import { useMutation, useQuery } from "@apollo/client";
import Link from "next/link";
import { useEffect, useState } from "react";

import { CreateModal } from "@/components/create-modal/create-modal";
import { Detail } from "@/components/detail/detail";
import { ImageBatch } from "@/components/image-batch/image-batch";
import { MemorySearch } from "@/components/memory-search/memory-search";
import { Tree } from "@/components/tree/tree";
import { MUTATION_START_TASK, QUERY_TASKS } from "@/lib/graphql/documents";

import type { StartResult, Task } from "@/lib/types";
import type { FC } from "react";

interface TasksData {
  tasks: Task[];
}

interface ActiveJob {
  taskId: string;
  jobId: string;
}

const Page: FC = () => {
  const { data, refetch } = useQuery<TasksData>(QUERY_TASKS, { fetchPolicy: "cache-and-network" });
  const [startMutation] = useMutation<{ startTask: StartResult }, { id: string; start: boolean }>(
    MUTATION_START_TASK
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [job, setJob] = useState<ActiveJob | null>(null);
  const tasks = data?.tasks ?? [];

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("task");
    if (id) {
      setSelected(id);
    }
  }, []);

  const refresh = async () => {
    await refetch();
    setVersion((v) => v + 1);
  };

  const startTask = async (id: string) => {
    setSelected(id);
    setVersion((v) => v + 1);
    await refetch();
  };

  const startFromTree = async (id: string) => {
    const res = await startMutation({ variables: { id, start: true } });
    const jobId = res.data?.startTask.jobId;
    if (jobId) {
      setJob({ taskId: id, jobId });
      setSelected(id);
      setVersion((v) => v + 1);
    }
  };

  const closeTask = (id: string) => {
    setJob(null);
    if (selected === id) {
      setSelected(null);
    }
    void refetch();
    setVersion((v) => v + 1);
  };

  return (
    <>
      <header>
        <h1>flow</h1>
        <span className="sub">задачи · этапы · память</span>
        <MemorySearch
          onSelect={(id) => {
            setSelected(id);
            setVersion((v) => v + 1);
          }}
        />
        <ImageBatch />
        <button className="refresh" onClick={() => void refresh()}>
          обновить
        </button>
        <button className="primary" onClick={() => setModalOpen(true)}>
          + задача
        </button>
        <Link className="nav-link" href="/board">
          борда
        </Link>
      </header>
      <main>
        <aside>
          <Tree
            tasks={tasks}
            selected={selected}
            onSelect={setSelected}
            onStart={(id) => void startFromTree(id)}
            onFinish={closeTask}
          />
        </aside>
        <section className="detail">
          {selected ? (
            <Detail
              key={`${selected}:${version}`}
              id={selected}
              job={job}
              onJobEnd={() => setJob(null)}
              onClosed={closeTask}
              onStart={startTask}
              onRefresh={refresh}
              onEdit={setEditId}
            />
          ) : (
            <p className="empty">Выбери задачу слева.</p>
          )}
        </section>
      </main>
      <CreateModal
        open={modalOpen || editId !== null}
        editId={editId}
        onClose={() => {
          setModalOpen(false);
          setEditId(null);
        }}
        onCreated={async (id) => {
          await refetch();
          setSelected(id);
          setVersion((v) => v + 1);
        }}
      />
    </>
  );
};

export default Page;
