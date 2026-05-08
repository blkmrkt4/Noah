"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Input } from "./ui";

type ScanKind =
  | "technical_description"
  | "reviewer_risk_review"
  | "question_prepopulation";

type ScanStatus = "pending" | "running" | "succeeded" | "failed";

interface ScanRun {
  id: string;
  kind: ScanKind;
  status: ScanStatus;
  commitSha: string | null;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
  output: unknown;
}

interface RepoState {
  repoUrl: string | null;
  lastScanSha: string | null;
  lastScanAt: string | null;
}

interface ScansResponse {
  runs: Record<ScanKind, ScanRun | null>;
}

const SCAN_ROWS: { kind: ScanKind; label: string; description: string }[] = [
  {
    kind: "technical_description",
    label: "Technical description",
    description: "Evidence-cited technical writeup. JSON output.",
  },
  {
    kind: "reviewer_risk_review",
    label: "Reviewer risk review",
    description: "Plain-English document for non-technical reviewers.",
  },
  {
    kind: "question_prepopulation",
    label: "Question pre-population",
    description: "Inject candidate answers where repo evidence supports them.",
  },
];

export default function RepoConnect({
  projectId,
  prepopByDefault = true,
  onRunsChanged,
}: {
  projectId: string;
  // Whether the "include question pre-population" checkbox starts checked.
  // The ingestion page passes false when the project already has any answers,
  // to avoid surprising the owner with new system-inferred rows.
  prepopByDefault?: boolean;
  // Notify the parent (e.g. the ingestion page tabs) when scans finish.
  onRunsChanged?: () => void;
}) {
  const [state, setState] = useState<RepoState | null>(null);
  const [runs, setRuns] = useState<Record<ScanKind, ScanRun | null> | null>(null);
  const [draftUrl, setDraftUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [runningKinds, setRunningKinds] = useState<Set<ScanKind>>(new Set());
  const [includePrepop, setIncludePrepop] = useState(prepopByDefault);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [repoRes, scansRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/repo`),
        fetch(`/api/projects/${projectId}/repo/scans`),
      ]);
      if (cancelled) return;
      if (repoRes.ok) {
        const data = await repoRes.json();
        if (cancelled) return;
        setState({
          repoUrl: data.repoUrl,
          lastScanSha: data.lastScanSha,
          lastScanAt: data.lastScanAt,
        });
        setDraftUrl(data.repoUrl ?? "");
      }
      if (scansRes.ok) {
        const data: ScansResponse = await scansRes.json();
        if (cancelled) return;
        setRuns(data.runs);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // While any scan is `running`, poll every 1s so the live ticker (token
  // count, streaming text, elapsed seconds) feels alive. Stops polling once
  // nothing is running.
  const anyRunning =
    !!runs &&
    Object.values(runs).some((r) => r?.status === "running");

  useEffect(() => {
    if (!anyRunning) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/projects/${projectId}/repo/scans`);
        if (!res.ok || cancelled) return;
        const data: ScansResponse = await res.json();
        setRuns(data.runs);
      } catch {
        // Transient fetch error — let the next tick try again.
      }
    }, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [anyRunning, projectId]);

  // Local elapsed-time tick so the seconds counter updates even between polls.
  const [, setNowTick] = useState(0);
  useEffect(() => {
    if (!anyRunning) return;
    const t = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [anyRunning]);

  async function reload() {
    const [repoRes, scansRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/repo`),
      fetch(`/api/projects/${projectId}/repo/scans`),
    ]);
    if (repoRes.ok) {
      const data = await repoRes.json();
      setState({
        repoUrl: data.repoUrl,
        lastScanSha: data.lastScanSha,
        lastScanAt: data.lastScanAt,
      });
      setDraftUrl(data.repoUrl ?? "");
    }
    if (scansRes.ok) {
      const data: ScansResponse = await scansRes.json();
      setRuns(data.runs);
    }
  }

  async function cancelRun(runId: string) {
    await fetch(`/api/projects/${projectId}/repo/scans/${runId}/cancel`, {
      method: "POST",
    });
    // Don't await reload — the poller will pick up the change.
  }

  async function saveUrl() {
    setBusy(true);
    setStatus("Saving...");
    const res = await fetch(`/api/projects/${projectId}/repo`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoUrl: draftUrl }),
    });
    const result = await res.json();
    if (!res.ok) {
      setStatus(`Error: ${result.error ?? "Save failed"}`);
    } else {
      setStatus("Saved");
      await reload();
    }
    setBusy(false);
  }

  async function runScan(kind?: ScanKind) {
    const targetKinds: ScanKind[] = kind
      ? [kind]
      : SCAN_ROWS.map((r) => r.kind).filter(
          (k) => includePrepop || k !== "question_prepopulation"
        );
    if (targetKinds.length === 0) return;
    setRunningKinds(new Set(targetKinds));
    setStatus(
      kind
        ? `Running ${kindLabel(kind)}…`
        : targetKinds.length === SCAN_ROWS.length
          ? "Running all scans…"
          : `Running ${targetKinds.length} scans…`
    );
    try {
      const body = kind ? { kind } : { kinds: targetKinds };
      const res = await fetch(`/api/projects/${projectId}/repo/scans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) {
        setStatus(`Error: ${result.error ?? "Scan failed"}`);
      } else {
        setStatus(kind ? `${kindLabel(kind)} complete` : "Scans complete");
      }
    } finally {
      setRunningKinds(new Set());
      await reload();
      onRunsChanged?.();
    }
  }

  if (!state || !runs) {
    return <p className="text-xs text-ey-sonic-silver">Loading…</p>;
  }

  return (
    <div>
      <Input
        label="GitHub repository URL"
        name="repoUrl"
        value={draftUrl}
        onChange={(e) => setDraftUrl(e.target.value)}
        placeholder="https://github.com/owner/repo"
      />

      <div className="flex flex-wrap items-center gap-3 mt-3">
        <Button
          variant="secondary"
          onClick={saveUrl}
          disabled={busy || draftUrl === (state.repoUrl ?? "")}
        >
          Save URL
        </Button>
        <Button
          onClick={() => runScan()}
          disabled={busy || !state.repoUrl || runningKinds.size > 0}
        >
          {runningKinds.size > 0 ? "Running…" : "Run all scans"}
        </Button>
        <label className="flex items-center gap-2 text-xs text-ey-light-gray cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includePrepop}
            onChange={(e) => setIncludePrepop(e.target.checked)}
            className="accent-ey-yellow"
          />
          <span>
            Include question pre-population
            <span className="text-ey-sonic-silver">
              {" "}· only writes to unanswered questions
            </span>
          </span>
        </label>
      </div>

      {status && <p className="text-xs text-ey-light-gray mt-2">{status}</p>}

      <div className="mt-4 space-y-2">
        {SCAN_ROWS.map((row) => (
          <ScanRowItem
            key={row.kind}
            label={row.label}
            description={row.description}
            run={runs[row.kind]}
            running={runningKinds.has(row.kind)}
            disabled={busy || !state.repoUrl}
            projectId={projectId}
            onRun={() => runScan(row.kind)}
            onCancel={cancelRun}
          />
        ))}
      </div>
    </div>
  );
}

function ScanRowItem({
  label,
  description,
  run,
  running,
  disabled,
  projectId,
  onRun,
  onCancel,
}: {
  label: string;
  description: string;
  run: ScanRun | null;
  running: boolean;
  disabled: boolean;
  projectId: string;
  onRun: () => void;
  onCancel: (runId: string) => void;
}) {
  const effectiveStatus: ScanStatus | null = running
    ? "running"
    : run?.status ?? null;
  const isInFlight =
    running || run?.status === "running";
  const prepop = run && isPrepopOutput(run.output) ? run.output : null;
  const liveStream = run && !prepop && isLiveStream(run.output) ? run.output : null;

  // Pick whichever live counters are available for the in-flight scan. Prepop
  // accumulates total tokens across all calls; tech/risk show the live single
  // call's approx token count while it streams.
  const tokensLive = prepop
    ? prepop.tokensUsed + (prepop.streamTokensApprox ?? 0)
    : liveStream?.streamTokensApprox ?? 0;
  const streamTail = prepop?.streamTail ?? liveStream?.streamTail ?? "";
  const elapsed = run?.status === "running" ? elapsedSeconds(run.startedAt) : null;

  return (
    <div className="border border-ey-sonic-silver/20 rounded-md p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-white text-sm font-medium">{label}</p>
            <StatusPill status={effectiveStatus} />
          </div>
          <p className="text-xs text-ey-sonic-silver mt-0.5">{description}</p>

          {/* Live ticker — one line. Visible while the run is running. */}
          {run?.status === "running" && (
            <div className="mt-1.5 flex items-center gap-2 text-[11px] tabular-nums">
              {elapsed !== null && (
                <span className="text-ey-light-gray flex-shrink-0">
                  {formatElapsed(elapsed)}
                </span>
              )}
              {tokensLive > 0 && (
                <span className="text-frame-blue flex-shrink-0">
                  {prepop ? "" : "~"}
                  {tokensLive.toLocaleString()} tok
                </span>
              )}
              {prepop && prepop.total > 0 && (
                <span className="text-ey-sonic-silver flex-shrink-0">
                  {prepop.processed}/{prepop.total} · {prepop.answersWritten} written
                </span>
              )}
              {streamTail && (
                <span className="text-ey-sonic-silver/70 truncate font-mono text-[10px] min-w-0">
                  {streamTail.replace(/\s+/g, " ")}
                </span>
              )}
            </div>
          )}

          {/* Per-question progress bar for prepop (only when it's actively cycling) */}
          {prepop && run?.status === "running" && prepop.total > 0 && (
            <div className="mt-1.5 h-1 bg-black rounded-full overflow-hidden">
              <div
                className="h-full bg-frame-blue rounded-full transition-all"
                style={{
                  width: `${Math.round((prepop.processed / prepop.total) * 100)}%`,
                }}
              />
            </div>
          )}

          {run?.finishedAt && (
            <p className="text-xs text-ey-sonic-silver mt-1">
              Last run {new Date(run.finishedAt).toLocaleString()}
              {run.commitSha && (
                <>
                  {" "}·{" "}
                  <code className="text-ey-yellow font-mono">
                    {run.commitSha.slice(0, 7)}
                  </code>
                </>
              )}
              {prepop && run.status === "succeeded" && (
                <>
                  {" "}· {prepop.answersWritten} written ·{" "}
                  {prepop.tokensUsed.toLocaleString()} tokens
                </>
              )}
            </p>
          )}
          {run?.status === "failed" && run.errorMessage && (
            <p className="text-xs text-frame-red mt-1 truncate" title={run.errorMessage}>
              {run.errorMessage}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {isInFlight && run ? (
            <button
              type="button"
              onClick={() => onCancel(run.id)}
              disabled={run.status !== "running"}
              className="text-xs text-frame-red hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={onRun}
              disabled={disabled}
              className="text-xs text-ey-yellow hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
            >
              {run ? "Re-run" : "Run"}
            </button>
          )}
          {run?.status === "succeeded" && run.kind !== "question_prepopulation" && (
            <Link
              href={`/projects/${projectId}/scans/${run.kind}`}
              className="text-xs text-ey-light-gray hover:text-ey-yellow"
            >
              View output
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: ScanStatus | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide bg-ey-sonic-silver/20 text-ey-sonic-silver">
        Not run
      </span>
    );
  }
  const conf = {
    pending: { bg: "bg-ey-sonic-silver/20", text: "text-ey-sonic-silver", label: "Pending" },
    running: { bg: "bg-frame-blue/20", text: "text-frame-blue", label: "Running" },
    succeeded: { bg: "bg-frame-green/20", text: "text-frame-green", label: "Done" },
    failed: { bg: "bg-frame-red/20", text: "text-frame-red", label: "Failed" },
  }[status];
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide ${conf.bg} ${conf.text}`}>
      {conf.label}
    </span>
  );
}

function kindLabel(kind: ScanKind): string {
  return SCAN_ROWS.find((r) => r.kind === kind)?.label ?? kind;
}

interface PrepopOutput {
  answersWritten: number;
  questionsConsidered: number;
  lowConfidenceSkipped: number;
  processed: number;
  total: number;
  tokensUsed: number;
  cancelled: boolean;
  streamTail?: string;
  streamTokensApprox?: number;
}

function isPrepopOutput(value: unknown): value is PrepopOutput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.answersWritten === "number" &&
    typeof v.processed === "number" &&
    typeof v.total === "number"
  );
}

/** Stream telemetry shape used by tech/risk while their single LLM call streams. */
interface LiveStream {
  streamTail: string;
  streamTokensApprox: number;
}
function isLiveStream(value: unknown): value is LiveStream {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.streamTail === "string" && typeof v.streamTokensApprox === "number";
}

function elapsedSeconds(startedAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m${s.toString().padStart(2, "0")}s`;
}
