"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  PageTitle,
  Card,
  Badge,
  Button,
  StatusIndicator,
  SectionTitle,
} from "@/components/ui";

interface Project {
  id: string;
  name: string;
  status: string;
  scopeType: string;
  createdAt: string;
  commercialOwner: { name: string; email: string };
  sectionStates: {
    id: string;
    section: { id: string; slug: string; displayName: string; displayOrder: number };
    state: string;
  }[];
  answers: {
    id: string;
    questionVersion: { question: { section: { slug: string } } };
  }[];
  documents: { id: string; filename: string; extractions: unknown[] }[];
  patternMatches: {
    fitScore: number;
    patternVersion: { pattern: { name: string } };
  }[];
  reviews: {
    id: string;
    domain: string;
    status: string;
    disposition: string | null;
    sectionId?: string | null;
  }[];
  delegations: {
    id: string;
    scopeType: "section" | "question_set";
    scopeTarget: unknown;
    status: string;
  }[];
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => r.json())
      .then(setProject)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-ey-sonic-silver">Loading...</div>;
  if (!project) return <div className="p-8 text-frame-red">Project not found</div>;

  const sectionStates = project.sectionStates.sort(
    (a, b) => a.section.displayOrder - b.section.displayOrder
  );

  const answersBySection = countBy(
    project.answers,
    (a) => a.questionVersion.question.section.slug
  );
  // Reviews carry sectionId (Section.id, not slug). Translate via the lookup.
  const slugBySectionId = Object.fromEntries(
    sectionStates.map((s) => [s.section.id, s.section.slug])
  );
  const reviewsBySection = countBy(
    project.reviews.filter((r) => r.sectionId),
    (r) => slugBySectionId[r.sectionId ?? ""] ?? ""
  );
  // Delegations may target a section by slug or id depending on caller. Be
  // defensive — match either, and ignore non-section scopes.
  const delegationsBySection = countBy(
    (project.delegations ?? []).filter((d) => d.scopeType === "section"),
    (d) => {
      const t = d.scopeTarget as Record<string, unknown> | null;
      const slug = t && typeof t === "object" ? (t.sectionSlug as string | undefined) : undefined;
      const idMatch = t && typeof t === "object" ? (t.sectionId as string | undefined) : undefined;
      return slug ?? slugBySectionId[idMatch ?? ""] ?? "";
    }
  );

  return (
    <div className="px-6 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <PageTitle>{project.name}</PageTitle>
          <div className="flex items-center gap-4 text-sm text-ey-sonic-silver">
            <span>Owner: {project.commercialOwner.name}</span>
            <StatusIndicator status={project.status} />
            <Badge color="yellow">{project.scopeType.replace("_", " ")}</Badge>
          </div>
        </div>
        <div className="flex gap-3">
          {project.status === "drafting" && (
            <Button
              variant="secondary"
              onClick={async () => {
                const res = await fetch(`/api/projects/${id}/submit`, {
                  method: "POST",
                });
                if (res.ok) window.location.reload();
              }}
            >
              Submit for Review
            </Button>
          )}
        </div>
      </div>

      {/* Action bar above sections */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Link href={`/projects/${id}/ingestion`}>
          <Button variant="secondary">Ingestion</Button>
        </Link>
        <Link href={`/projects/${id}/questionnaire`}>
          <Button>Open Questionnaire</Button>
        </Link>
      </div>

      {/* Sections — single-column dense rows, color = activity */}
      <div className="mb-2 flex items-baseline justify-between">
        <SectionTitle>Sections</SectionTitle>
        <span className="text-xs text-ey-sonic-silver tabular-nums">
          {project.answers.length} answered · {project.reviews.length} reviews ·{" "}
          {(project.delegations ?? []).length} delegations · {project.documents.length} documents
        </span>
      </div>
      <div className="space-y-1.5 mb-8">
        {/* Always-first virtual section: scan outputs + uploaded docs + links */}
        <Link
          href={`/projects/${id}/questionnaire?section=intake_docs`}
          className="block rounded-md transition-all hover:ring-1 hover:ring-frame-orange/50"
        >
          <div className="flex items-center gap-4 px-4 py-3 rounded-md border-l-2 border-l-frame-orange bg-frame-orange/10 cursor-pointer">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate text-frame-orange">
                Intake Documents and Links
              </h3>
              <p className="text-[11px] text-frame-orange/70 mt-0.5">
                Scan outputs, uploaded documents, and reference links — always available.
              </p>
            </div>
            <span className="text-[10px] uppercase tracking-wide text-frame-orange/80">
              Always on
            </span>
          </div>
        </Link>

        {sectionStates.map((ss) => {
          const answered = answersBySection.get(ss.section.slug) ?? 0;
          const reviews = reviewsBySection.get(ss.section.slug) ?? 0;
          const delegations = delegationsBySection.get(ss.section.slug) ?? 0;
          const hasActivity = answered + reviews + delegations > 0;
          return (
            <Link
              key={ss.id}
              href={`/projects/${id}/questionnaire?section=${ss.section.slug}`}
              className="block rounded-md transition-all hover:ring-1 hover:ring-ey-yellow/40"
            >
              <div
                className={`flex items-center gap-4 px-4 py-3 rounded-md border-l-2 cursor-pointer ${
                  hasActivity
                    ? "bg-ey-dark-gray border-l-ey-yellow"
                    : "bg-ey-dark-gray/60 border-l-transparent hover:border-l-ey-sonic-silver/40"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <h3
                    className={`font-medium text-sm truncate ${
                      hasActivity ? "text-white" : "text-ey-light-gray"
                    }`}
                  >
                    {ss.section.displayName}
                  </h3>
                </div>
                <MetricChip count={answered} label="answered" tone="yellow" />
                <MetricChip count={reviews} label="reviewed" tone="blue" />
                <MetricChip count={delegations} label="delegated" tone="orange" />
                <StatusPill state={ss.state} />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Reviews */}
      {project.reviews.length > 0 && (
        <>
          <SectionTitle>Reviews</SectionTitle>
          <div className="space-y-3 mb-8">
            {project.reviews.map((review) => (
              <Card key={review.id}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge color="purple">{review.domain}</Badge>
                    <StatusIndicator status={review.status} />
                  </div>
                  {review.disposition && (
                    <Badge
                      color={
                        review.disposition === "approve"
                          ? "green"
                          : review.disposition === "reject"
                            ? "red"
                            : "orange"
                      }
                    >
                      {review.disposition}
                    </Badge>
                  )}
                  <a href={`/projects/${id}/review?reviewId=${review.id}`}>
                    <Button variant="secondary">View</Button>
                  </a>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Pattern matches — quiet footer */}
      {project.patternMatches.length > 0 && (
        <Card>
          <h3 className="text-ey-yellow text-sm font-semibold mb-3">
            Pattern Matches
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
            {project.patternMatches.map((pm, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-ey-light-gray truncate mr-2">
                    {pm.patternVersion.pattern.name}
                  </span>
                  <span className="text-white tabular-nums">
                    {Math.round(pm.fitScore * 100)}%
                  </span>
                </div>
                <div className="h-1 bg-black rounded-full">
                  <div
                    className={`h-full rounded-full ${
                      pm.fitScore >= 1
                        ? "bg-frame-green"
                        : pm.fitScore >= 0.8
                          ? "bg-frame-orange"
                          : "bg-ey-sonic-silver"
                    }`}
                    style={{ width: `${pm.fitScore * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function MetricChip({
  count,
  label,
  tone,
}: {
  count: number;
  label: string;
  tone: "yellow" | "blue" | "orange";
}) {
  const active = count > 0;
  const palette: Record<typeof tone, { bg: string; num: string; lbl: string }> = {
    yellow: {
      bg: "bg-ey-yellow/15",
      num: "text-ey-yellow",
      lbl: "text-ey-yellow/80",
    },
    blue: {
      bg: "bg-frame-blue/15",
      num: "text-frame-blue",
      lbl: "text-frame-blue/80",
    },
    orange: {
      bg: "bg-frame-orange/15",
      num: "text-frame-orange",
      lbl: "text-frame-orange/80",
    },
  };
  const p = palette[tone];
  return (
    <div
      className={`flex-shrink-0 flex items-baseline gap-1.5 px-2.5 py-1 rounded text-xs tabular-nums w-24 ${
        active
          ? p.bg
          : "bg-ey-sonic-silver/10"
      }`}
    >
      <span
        className={`font-semibold text-sm ${
          active ? p.num : "text-ey-sonic-silver/50"
        }`}
      >
        {count}
      </span>
      <span
        className={`uppercase tracking-wide text-[10px] ${
          active ? p.lbl : "text-ey-sonic-silver/40"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function StatusPill({ state }: { state: string }) {
  const conf: Record<string, { bg: string; text: string; label: string }> = {
    drafting: { bg: "bg-ey-sonic-silver/20", text: "text-ey-sonic-silver", label: "Drafting" },
    released: { bg: "bg-frame-blue/20", text: "text-frame-blue", label: "Released" },
    under_review: { bg: "bg-frame-orange/20", text: "text-frame-orange", label: "Review" },
    cleared: { bg: "bg-frame-green/20", text: "text-frame-green", label: "Cleared" },
  };
  const c = conf[state] ?? conf.drafting;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide flex-shrink-0 ${c.bg} ${c.text}`}
    >
      {c.label}
    </span>
  );
}

function countBy<T>(items: T[], keyFn: (item: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const item of items) {
    const k = keyFn(item);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}
