"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, PageTitle } from "@/components/ui";

type ScanKind =
  | "technical_description"
  | "reviewer_risk_review"
  | "question_prepopulation";

const KIND_LABEL: Record<ScanKind, string> = {
  technical_description: "Technical description",
  reviewer_risk_review: "Reviewer risk review",
  question_prepopulation: "Question pre-population",
};

interface ScanRun {
  id: string;
  kind: ScanKind;
  status: "pending" | "running" | "succeeded" | "failed";
  commitSha: string | null;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
  output: unknown;
}

export default function ScanOutputPage() {
  const { id, kind } = useParams<{ id: string; kind: ScanKind }>();
  const [run, setRun] = useState<ScanRun | null | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/projects/${id}/repo/scans`)
      .then((r) => r.json())
      .then((data) => setRun(data.runs?.[kind] ?? null))
      .catch(() => setRun(null));
  }, [id, kind]);

  return (
    <div className="px-6 py-8 max-w-4xl space-y-6">
      <div>
        <Link
          href={`/projects/${id}`}
          className="text-xs text-ey-yellow hover:underline"
        >
          ← Back to case
        </Link>
        <PageTitle>{KIND_LABEL[kind] ?? "Scan output"}</PageTitle>
      </div>

      {run === undefined && <Card><p className="text-ey-sonic-silver">Loading…</p></Card>}
      {run === null && (
        <Card>
          <p className="text-ey-sonic-silver">No run found for this scan kind.</p>
        </Card>
      )}
      {run && <RunBody run={run} />}
    </div>
  );
}

function RunBody({ run }: { run: ScanRun }) {
  return (
    <>
      <Card className="text-sm space-y-2">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-ey-sonic-silver">
          <span>
            Status:{" "}
            <span className={run.status === "failed" ? "text-frame-red" : "text-white"}>
              {run.status}
            </span>
          </span>
          {run.commitSha && (
            <span>
              Commit:{" "}
              <code className="text-ey-yellow font-mono">{run.commitSha.slice(0, 7)}</code>
            </span>
          )}
          {run.finishedAt && (
            <span>
              Finished: <span className="text-white">{new Date(run.finishedAt).toLocaleString()}</span>
            </span>
          )}
        </div>
        {run.errorMessage && (
          <p className="text-frame-red text-xs">{run.errorMessage}</p>
        )}
      </Card>

      {run.status === "succeeded" && (
        run.kind === "reviewer_risk_review" ||
        run.kind === "technical_description" ? (
          <RiskReviewOutput output={run.output} />
        ) : (
          <PrepopOutput output={run.output} />
        )
      )}
    </>
  );
}

function RiskReviewOutput({ output }: { output: unknown }) {
  const md = isMarkdownOutput(output) ? output.markdown : "";
  return (
    <Card>
      <pre className="whitespace-pre-wrap text-sm text-ey-light-gray font-sans leading-relaxed">
        {md || "(no markdown returned)"}
      </pre>
    </Card>
  );
}

function JsonOutput({ output }: { output: unknown }) {
  return (
    <Card className="p-0 overflow-hidden">
      <pre className="text-xs text-ey-light-gray font-mono p-4 overflow-x-auto">
        {JSON.stringify(output, null, 2)}
      </pre>
    </Card>
  );
}

function PrepopOutput({ output }: { output: unknown }) {
  const stats = isPrepopStats(output) ? output : null;
  if (!stats) return <JsonOutput output={output} />;
  return (
    <Card>
      <dl className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <dt className="text-ey-sonic-silver text-xs uppercase tracking-wide">
            Answers written
          </dt>
          <dd className="text-frame-green text-2xl font-semibold mt-1">
            {stats.answersWritten}
          </dd>
        </div>
        <div>
          <dt className="text-ey-sonic-silver text-xs uppercase tracking-wide">
            Questions considered
          </dt>
          <dd className="text-white text-2xl font-semibold mt-1">
            {stats.questionsConsidered}
          </dd>
        </div>
        <div>
          <dt className="text-ey-sonic-silver text-xs uppercase tracking-wide">
            Skipped (low confidence)
          </dt>
          <dd className="text-ey-light-gray text-2xl font-semibold mt-1">
            {stats.lowConfidenceSkipped}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

function isMarkdownOutput(value: unknown): value is { markdown: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "markdown" in value &&
    typeof (value as Record<string, unknown>).markdown === "string"
  );
}

function isPrepopStats(
  value: unknown
): value is {
  answersWritten: number;
  questionsConsidered: number;
  lowConfidenceSkipped: number;
} {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.answersWritten === "number" &&
    typeof v.questionsConsidered === "number" &&
    typeof v.lowConfidenceSkipped === "number"
  );
}
