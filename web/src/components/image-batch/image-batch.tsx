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
  url: string | null;
  error: string | null;
}

const kb = (bytes: number) => `${Math.round(bytes / 1024)} КБ`;

export const ImageBatch: FC = () => {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [quality, setQuality] = useState(80);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ConvertedFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const urlsRef = useRef<string[]>([]);

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

  const convert = async () => {
    setBusy(true);
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current = [];
    const next: ConvertedFile[] = [];
    for (const file of files) {
      const response = await fetch(`/api/convert?quality=${quality}`, {
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
          url: null,
          error: await response.text(),
        });
        continue;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      urlsRef.current.push(url);
      next.push({
        id: crypto.randomUUID(),
        name: `${file.name.replace(/\.[^.]+$/, "")}.webp`,
        before: file.size,
        after: blob.size,
        url,
        error: null,
      });
    }
    setResults(next);
    setBusy(false);
  };

  return (
    <div className="images">
      <button onClick={() => setOpen((v) => !v)}>картинки</button>
      {open && (
        <div className="images-panel">
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
            <select value={quality} onChange={(e) => setQuality(Number(e.target.value))}>
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
          </div>
          {files.length > 0 && (
            <ul className="images-files">
              {files.map((file) => (
                <li key={`${file.name}:${file.size}:${file.lastModified}`}>
                  <span>{file.name}</span>
                  <span>{kb(file.size)}</span>
                </li>
              ))}
            </ul>
          )}
          {files.length > 0 && (
            <button className="images-clear" onClick={() => setFiles([])}>
              очистить
            </button>
          )}
          {results.length > 0 && (
            <ul className="images-results">
              {results.map((result) => (
                <li key={result.id}>
                  {result.url ? (
                    <a href={result.url} download={result.name}>
                      {result.name}
                    </a>
                  ) : (
                    <span>{result.name}</span>
                  )}
                  <span className={result.error ? "images-error" : undefined}>
                    {result.error ??
                      `${kb(result.before)} → ${kb(result.after)} (${Math.max(0, Math.round(100 - (result.after / result.before) * 100))}%)`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
