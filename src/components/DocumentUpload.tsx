"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";

interface Extraction {
  id: string;
  summary: string;
  extractedAt: string;
}

interface Doc {
  id: string;
  filename: string;
  mimeType: string;
  uploadedAt: string;
  extractions: Extraction[];
}

const ACCEPT = ".pdf,.docx,.txt,.md";

export default function DocumentUpload({ projectId }: { projectId: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadDocs();
  }, [projectId]);

  async function loadDocs() {
    const res = await fetch(`/api/projects/${projectId}/documents`);
    if (res.ok) setDocs(await res.json());
  }

  async function uploadFiles(files: FileList | File[]) {
    if (files.length === 0) return;
    setBusy(true);
    setStatus(`Uploading ${files.length} file(s)...`);
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("files", f);

    try {
      const res = await fetch(`/api/projects/${projectId}/documents/upload`, {
        method: "POST",
        body: fd,
      });
      const result = await res.json();
      if (!res.ok) {
        setStatus(`Error: ${result.error ?? "Upload failed"}`);
      } else {
        const popMsg =
          result.answersPrePopulated > 0
            ? ` · ${result.answersPrePopulated} answer(s) pre-populated`
            : "";
        setStatus(`Uploaded ${result.uploaded} file(s)${popMsg}`);
        await loadDocs();
      }
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (busy) return;
    void uploadFiles(e.dataTransfer.files);
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => !busy && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          isDragging
            ? "border-ey-yellow bg-ey-yellow/5"
            : "border-ey-sonic-silver/40 hover:border-ey-yellow/50"
        } ${busy ? "opacity-50 cursor-wait" : ""}`}
      >
        <p className="text-ey-light-gray text-sm">
          {busy ? "Working..." : "Drop documents here or click to browse"}
        </p>
        <p className="text-xs text-ey-sonic-silver mt-2">
          PDF, DOCX, TXT, MD · multiple files supported
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {status && (
        <p className="text-xs text-ey-light-gray mt-2 px-1">{status}</p>
      )}

      {docs.length > 0 && (
        <ul className="mt-4 space-y-2">
          {docs.map((d) => {
            const extraction = d.extractions[0];
            return (
              <li
                key={d.id}
                className="flex items-start justify-between gap-3 p-3 rounded-lg bg-ey-dark-gray/50 border border-ey-sonic-silver/20"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{d.filename}</p>
                  <p className="text-xs text-ey-sonic-silver mt-0.5">
                    {new Date(d.uploadedAt).toLocaleString()}
                  </p>
                  {extraction ? (
                    <p className="text-xs text-ey-light-gray mt-1.5 line-clamp-2">
                      {extraction.summary}
                    </p>
                  ) : (
                    <p className="text-xs text-ey-sonic-silver mt-1.5">
                      Extraction pending…
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {docs.length === 0 && !busy && (
        <p className="text-xs text-ey-sonic-silver mt-3 px-1">
          No documents uploaded yet.
        </p>
      )}

      <div className="mt-3">
        <Button variant="secondary" onClick={loadDocs} disabled={busy}>
          Refresh
        </Button>
      </div>
    </div>
  );
}
