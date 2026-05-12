"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Card, PageTitle } from "@/components/ui";
import RepoConnect from "@/components/RepoConnect";
import DocumentUpload from "@/components/DocumentUpload";
import ProjectLinks from "@/components/ProjectLinks";

type ScanKind =
  | "technical_description"
  | "reviewer_risk_review"
  | "question_prepopulation";

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

type RunMap = Record<ScanKind, ScanRun | null>;

interface ProjectSummary {
  id: string;
  name: string;
  answerCount: number;
}

export default function IngestionPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [runs, setRuns] = useState<RunMap | null>(null);
  const [activeTab, setActiveTab] = useState<"technical_description" | "reviewer_risk_review">(
    "technical_description"
  );

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => r.json())
      .then((p) =>
        setProject({
          id: p.id,
          name: p.name,
          answerCount: Array.isArray(p.answers) ? p.answers.length : 0,
        })
      )
      .catch(() => setProject(null));
  }, [id]);

  const refreshRuns = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}/repo/scans`);
    if (res.ok) {
      const data = await res.json();
      setRuns(data.runs);
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${id}/repo/scans`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setRuns(data.runs);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [id]);

  const techRun = runs?.technical_description ?? null;
  const riskRun = runs?.reviewer_risk_review ?? null;

  return (
    <div className="px-6 py-8 max-w-7xl space-y-6">
      <div>
        <Link
          href={`/projects/${id}`}
          className="text-xs text-ey-yellow hover:underline"
        >
          ← Back to case
        </Link>
        <PageTitle>{project ? `${project.name} · Ingestion` : "Ingestion"}</PageTitle>
        <p className="text-ey-light-gray text-sm -mt-4">
          Connect the repo, drop in supporting documents, and run the three scans
          that feed the questionnaire and the reviewers.
        </p>
      </div>

      <Card>
        <h2 className="text-ey-yellow text-sm font-semibold mb-4">
          GitHub repository
        </h2>
        {project && (
          <RepoConnect
            projectId={id}
            prepopByDefault={project.answerCount === 0}
            onRunsChanged={refreshRuns}
          />
        )}
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="border-b border-ey-sonic-silver/20 px-4 flex gap-2">
          <TabButton
            active={activeTab === "technical_description"}
            onClick={() => setActiveTab("technical_description")}
            label="Technical description"
            run={techRun}
          />
          <TabButton
            active={activeTab === "reviewer_risk_review"}
            onClick={() => setActiveTab("reviewer_risk_review")}
            label="Reviewer risk review"
            run={riskRun}
          />
        </div>
        <div className="p-4">
          {activeTab === "technical_description" ? (
            <TechnicalOutput run={techRun} />
          ) : (
            <RiskOutput run={riskRun} />
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-ey-yellow text-sm font-semibold mb-4">
          Case documents
        </h2>
        <DocumentUpload projectId={id} />
      </Card>

      <Card>
        <h2 className="text-ey-yellow text-sm font-semibold mb-4">
          Case links
        </h2>
        <ProjectLinks projectId={id} />
      </Card>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  run,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  run: ScanRun | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-3 text-sm border-b-2 transition-colors ${
        active
          ? "border-ey-yellow text-ey-yellow"
          : "border-transparent text-ey-light-gray hover:text-white"
      }`}
    >
      <span>{label}</span>
      {run?.status === "succeeded" && (
        <span className="ml-2 text-[10px] uppercase tracking-wide text-frame-green">
          Done
        </span>
      )}
      {run?.status === "running" && (
        <span className="ml-2 text-[10px] uppercase tracking-wide text-frame-blue">
          Running
        </span>
      )}
      {run?.status === "failed" && (
        <span className="ml-2 text-[10px] uppercase tracking-wide text-frame-red">
          Failed
        </span>
      )}
    </button>
  );
}

// Both the technical and reviewer-risk scans now produce human-readable
// markdown. Same renderer for both — the only difference is which run we feed.
function TechnicalOutput({ run }: { run: ScanRun | null }) {
  return <MarkdownScanOutput run={run} />;
}

function RiskOutput({ run }: { run: ScanRun | null }) {
  return <MarkdownScanOutput run={run} />;
}

function MarkdownScanOutput({ run }: { run: ScanRun | null }) {
  if (!run) {
    return <p className="text-ey-sonic-silver text-sm">Not run yet.</p>;
  }
  if (run.status === "running") {
    return <p className="text-ey-sonic-silver text-sm">Running…</p>;
  }
  if (run.status === "failed") {
    return (
      <p className="text-frame-red text-sm">
        {run.errorMessage ?? "Scan failed."}
      </p>
    );
  }
  const md = isMarkdownOutput(run.output) ? run.output.markdown : "";
  return (
    <pre className="whitespace-pre-wrap text-sm text-ey-light-gray font-sans leading-relaxed max-h-[600px] overflow-y-auto">
      {md || "(no markdown returned)"}
    </pre>
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
