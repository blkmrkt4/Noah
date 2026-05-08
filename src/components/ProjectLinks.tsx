"use client";

import { useEffect, useState } from "react";
import { Button, Input } from "./ui";

interface ProjectLink {
  id: string;
  url: string;
  label: string | null;
  createdAt: string;
}

export default function ProjectLinks({ projectId }: { projectId: string }) {
  const [links, setLinks] = useState<ProjectLink[] | null>(null);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/links`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setLinks(data.links ?? []);
      })
      .catch(() => {
        if (!cancelled) setLinks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function add() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, label: label || null }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to add link");
    } else {
      setLinks((prev) => [data.link, ...(prev ?? [])]);
      setUrl("");
      setLabel("");
    }
    setBusy(false);
  }

  async function remove(linkId: string) {
    const res = await fetch(`/api/projects/${projectId}/links/${linkId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setLinks((prev) => (prev ?? []).filter((l) => l.id !== linkId));
    }
  }

  return (
    <div>
      <p className="text-xs text-ey-sonic-silver mb-3">
        Reference URLs reviewers can follow. Not processed by AI — just stored.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 items-end mb-4">
        <Input
          label="URL"
          name="link-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://confluence.internal/..."
        />
        <Input
          label="Label (optional)"
          name="link-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Confluence page"
        />
        <Button onClick={add} disabled={busy || !url.trim()}>
          {busy ? "Adding…" : "Add link"}
        </Button>
      </div>

      {error && <p className="text-xs text-frame-red mb-2">{error}</p>}

      {links === null ? (
        <p className="text-xs text-ey-sonic-silver">Loading…</p>
      ) : links.length === 0 ? (
        <p className="text-xs text-ey-sonic-silver">No links added yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {links.map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded border border-ey-sonic-silver/20 bg-black/20"
            >
              <div className="min-w-0 flex-1">
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-ey-yellow hover:underline truncate block"
                >
                  {l.label || l.url}
                </a>
                {l.label && (
                  <p className="text-[11px] text-ey-sonic-silver truncate">{l.url}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(l.id)}
                className="text-xs text-ey-sonic-silver hover:text-frame-red flex-shrink-0"
                aria-label="Remove link"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
