"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui";

type ScanKind =
  | "technical_description"
  | "reviewer_risk_review"
  | "question_prepopulation";

interface ScanRun {
  id: string;
  kind: ScanKind;
  status: "pending" | "running" | "succeeded" | "failed";
  finishedAt: string | null;
  commitSha: string | null;
  output: unknown;
}

interface DocumentRow {
  id: string;
  filename: string;
  mimeType: string;
  uploadedAt: string;
}

interface ProjectLink {
  id: string;
  url: string;
  label: string | null;
  createdAt: string;
}

const KIND_LABEL: Record<ScanKind, string> = {
  technical_description: "Technical description",
  reviewer_risk_review: "Reviewer risk review",
  question_prepopulation: "Question pre-population",
};

export default function IntakeDocsView({ projectId }: { projectId: string }) {
  const [runs, setRuns] = useState<Record<ScanKind, ScanRun | null> | null>(null);
  const [docs, setDocs] = useState<DocumentRow[] | null>(null);
  const [links, setLinks] = useState<ProjectLink[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/projects/${projectId}/repo/scans`).then((r) =>
        r.ok ? r.json() : { runs: null }
      ),
      fetch(`/api/projects/${projectId}/documents`).then((r) =>
        r.ok ? r.json() : []
      ),
      fetch(`/api/projects/${projectId}/links`).then((r) =>
        r.ok ? r.json() : { links: [] }
      ),
    ])
      .then(([scans, docs, linksRes]) => {
        if (cancelled) return;
        setRuns(scans?.runs ?? null);
        setDocs(Array.isArray(docs) ? docs : []);
        setLinks(linksRes?.links ?? []);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return (
    <div className="space-y-6">
      <ScanSummary runs={runs} projectId={projectId} />
      <DocumentsList docs={docs} />
      <LinksList links={links} />
    </div>
  );
}

function ScanSummary({
  runs,
  projectId,
}: {
  runs: Record<ScanKind, ScanRun | null> | null;
  projectId: string;
}) {
  const order: ScanKind[] = [
    "technical_description",
    "reviewer_risk_review",
    "question_prepopulation",
  ];
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-frame-orange text-sm font-semibold">Scan outputs</h3>
        <Link
          href={`/projects/${projectId}/ingestion`}
          className="text-xs text-ey-yellow hover:underline"
        >
          Run scans →
        </Link>
      </div>
      {runs === null ? (
        <p className="text-xs text-ey-sonic-silver">Loading…</p>
      ) : (
        <ul className="space-y-1.5">
          {order.map((kind) => {
            const run = runs[kind];
            const linkable =
              run?.status === "succeeded" && kind !== "question_prepopulation";
            return (
              <li
                key={kind}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded border border-ey-sonic-silver/20"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white">{KIND_LABEL[kind]}</p>
                  <p className="text-[11px] text-ey-sonic-silver">
                    {run
                      ? run.status === "succeeded" && run.finishedAt
                        ? `Last run ${new Date(run.finishedAt).toLocaleString()}`
                        : run.status === "failed"
                          ? "Last run failed"
                          : run.status === "running"
                            ? "Running…"
                            : "Pending"
                      : "Not run yet"}
                  </p>
                </div>
                <ScanStatusPill status={run?.status ?? null} />
                {linkable && (
                  <Link
                    href={`/projects/${projectId}/scans/${kind}`}
                    className="text-xs text-ey-yellow hover:underline flex-shrink-0"
                  >
                    View
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function ScanStatusPill({
  status,
}: {
  status: ScanRun["status"] | null;
}) {
  const conf: Record<string, { bg: string; text: string; label: string }> = {
    succeeded: { bg: "bg-frame-green/15", text: "text-frame-green", label: "Done" },
    running: { bg: "bg-frame-blue/15", text: "text-frame-blue", label: "Running" },
    failed: { bg: "bg-frame-red/15", text: "text-frame-red", label: "Failed" },
    pending: { bg: "bg-ey-sonic-silver/15", text: "text-ey-sonic-silver", label: "Pending" },
  };
  if (!status) {
    return (
      <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide bg-ey-sonic-silver/10 text-ey-sonic-silver/60">
        Not run
      </span>
    );
  }
  const c = conf[status];
  return (
    <span
      className={`inline-flex px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide ${c.bg} ${c.text} flex-shrink-0`}
    >
      {c.label}
    </span>
  );
}

function DocumentsList({ docs }: { docs: DocumentRow[] | null }) {
  return (
    <Card>
      <h3 className="text-frame-orange text-sm font-semibold mb-3">
        Project documents
      </h3>
      {docs === null ? (
        <p className="text-xs text-ey-sonic-silver">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="text-xs text-ey-sonic-silver">
          No documents uploaded. Add them on the Ingestion page.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded border border-ey-sonic-silver/20"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white truncate">{d.filename}</p>
                <p className="text-[11px] text-ey-sonic-silver">
                  {d.mimeType} · uploaded {new Date(d.uploadedAt).toLocaleDateString()}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function LinksList({ links }: { links: ProjectLink[] | null }) {
  return (
    <Card>
      <h3 className="text-frame-orange text-sm font-semibold mb-3">
        Reference links
      </h3>
      {links === null ? (
        <p className="text-xs text-ey-sonic-silver">Loading…</p>
      ) : links.length === 0 ? (
        <p className="text-xs text-ey-sonic-silver">
          No links added. Add them on the Ingestion page.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {links.map((l) => (
            <li
              key={l.id}
              className="px-3 py-2 rounded border border-ey-sonic-silver/20"
            >
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
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
