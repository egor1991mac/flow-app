"use client";

import { useEffect, useRef, useState } from "react";

import type { ChangeEvent, FC } from "react";

const PRESETS = [
  { label: "Максимум 90", quality: 90 },
  { label: "Веб 80", quality: 80 },
  { label: "Лёгкий 65", quality: 65 },
  { label: "Миниатюра 45", quality: 45 },
];

interface ConvertedFile {
  id: string;
  name: string;
  before: number;
  after: number;
  beforeUrl: string;
  url: string | null;
  error: string | null;
}

const kb = (bytes: number) => `${Math.round(bytes / 1024)} КБ`;

export const ImageBatch: FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [quality, setQuality] = useState(80);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ConvertedFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const urlsRef = useRef<string[]>([]);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  useEffect(
    () => () => {
      urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    []
  );

  const add = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    if (picked.length) {
      setFiles((prev) => [...prev, ...picked]);
    }
    event.target.value = "";
  };

  const convert = async (preset = quality) => {
    if (busy) {
      return;
    }
    setBusy(true);
    setNote("");
    const next: ConvertedFile[] = [];
    const created: string[] = [];
    for (const file of files) {
      const beforeUrl = URL.createObjectURL(file);
      created.push(beforeUrl);
      const response = await fetch(`/api/convert?quality=${preset}`, {
        method: "POST",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!response.ok) {
        next.push({
          id: crypto.randomUUID(),
          name: file.name,
          before: file.size,
          after: 0,
          beforeUrl,
          url: null,
          error: await response.text(),
        });
        continue;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      created.push(url);
      next.push({
        id: crypto.randomUUID(),
        name: `${file.name.replace(/\.[^.]+$/, "")}.webp`,
        before: file.size,
        after: blob.size,
        beforeUrl,
        url,
        error: null,
      });
    }
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current = created;
    setResults(next);
    setBusy(false);
  };

  const save = async () => {
    const ready = results.filter((result) => result.url !== null);
    if (!ready.length) {
      return;
    }
    if (typeof window.showDirectoryPicker !== "function") {
      setNote("браузер не умеет выбирать папку, скачивайте по ссылкам");
      return;
    }
    setSaving(true);
    setNote("");
    try {
      const dir = await window.showDirectoryPicker({ mode: "readwrite" });
      for (const result of ready) {
        const handle = await dir.getFileHandle(result.name, { create: true });
        const writable = await handle.createWritable();
        await writable.write(await (await fetch(result.url as string)).blob());
        await writable.close();
      }
      setNote(`сохранено ${ready.length} в «${dir.name}»`);
    } catch (error) {
      setNote(error instanceof DOMException && error.name === "AbortError" ? "" : String(error));
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setFiles([]);
    setResults([]);
    setNote("");
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current = [];
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeResult = (id: string) => {
    const target = results.find((result) => result.id === id);
    if (target) {
      const urls = [target.beforeUrl, target.url].filter((url): url is string => url !== null);
      urls.forEach((url) => URL.revokeObjectURL(url));
      urlsRef.current = urlsRef.current.filter((url) => !urls.includes(url));
    }
    setResults((prev) => prev.filter((result) => result.id !== id));
  };

  const close = () => dialogRef.current?.close();

  return (
    <div className="images">
      <button onClick={() => dialogRef.current?.showModal()}>картинки</button>
      <dialog ref={dialogRef} className="modal images-modal" onClose={reset}>
        <div className="modal-head">
          <h2>картинки</h2>
          <button className="ghost" onClick={close}>
            ✕
          </button>
        </div>
        <div className="images-body">
          <div className="images-row">
            <button onClick={() => inputRef.current?.click()}>+ добавить</button>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/tiff,image/svg+xml"
              multiple
              hidden
              onChange={add}
            />
            <select
              value={quality}
              disabled={busy}
              onChange={(e) => {
                const next = Number(e.target.value);
                setQuality(next);
                if (results.length) {
                  void convert(next);
                }
              }}
            >
              {PRESETS.map((preset) => (
                <option key={preset.quality} value={preset.quality}>
                  {preset.label}
                </option>
              ))}
            </select>
            <button
              className="primary"
              disabled={!files.length || busy}
              onClick={() => void convert()}
            >
              {busy ? "обработка…" : `обработать (${files.length})`}
            </button>
            {files.length > 0 || results.length > 0 ? (
              <button className="images-clear" onClick={reset}>
                очистить
              </button>
            ) : null}
          </div>
          {files.length > 0 && (
            <ul className="images-files">
              {files.map((file, index) => (
                <li key={`${file.name}:${file.size}:${file.lastModified}`}>
                  <span className="images-file">
                    {previews[index] && (
                      <img className="images-thumb" src={previews[index]} alt="" />
                    )}
                    <span className="images-name">{file.name}</span>
                  </span>
                  <span className="images-file-actions">
                    <span>{kb(file.size)}</span>
                    <button className="ghost images-remove" onClick={() => removeFile(index)}>
                      ✕
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {results.length > 0 && (
            <ul className="images-results">
              {results.map((result) => (
                <li key={result.id}>
                  <span className="images-pair">
                    <img className="images-thumb" src={result.beforeUrl} alt="до" />
                    {result.url && <img className="images-thumb" src={result.url} alt="после" />}
                  </span>
                  <span className="images-meta">
                    {result.url ? (
                      <a href={result.url} download={result.name}>
                        {result.name}
                      </a>
                    ) : (
                      <span className="images-name">{result.name}</span>
                    )}
                    <span className={result.error ? "images-error" : undefined}>
                      {result.error ??
                        `${kb(result.before)} → ${kb(result.after)} (${Math.max(0, Math.round(100 - (result.after / result.before) * 100))}%)`}
                    </span>
                    <button className="ghost images-remove" onClick={() => removeResult(result.id)}>
                      ✕
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="modal-actions">
          <span className="sub">{note}</span>
          <button onClick={close}>Закрыть</button>
          <button
            className="primary"
            disabled={saving || !results.some((result) => Boolean(result.url))}
            onClick={() => void save()}
          >
            {saving ? "сохранение…" : "сохранить в папку"}
          </button>
        </div>
      </dialog>
    </div>
  );
};
