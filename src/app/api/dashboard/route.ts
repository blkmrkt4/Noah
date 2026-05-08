import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Persona = "commercial_owner" | "reviewer" | "collaborator" | "question_author";

type RiskLevel = "low" | "medium" | "high";

type ActivityEvent = {
  timestamp: string;
  projectId: string;
  projectName: string;
  type: string;
  message: string;
};

const REVIEW_STALE_HOURS = 72;
const ACTIVE_PROJECT_STATUSES = ["drafting", "submitted", "in_review"] as const;

function toHoursSince(date: Date | null | undefined): number {
  if (!date) return 0;
  return (Date.now() - date.getTime()) / (1000 * 60 * 60);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function percentile50(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function normalizePersona(value: string | null): Persona {
  if (value === "reviewer") return "reviewer";
  if (value === "collaborator") return "collaborator";
  if (value === "question_author") return "question_author";
  return "commercial_owner";
}

function jsonToStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function riskFromSignals(signals: {
  openClarifications: number;
  oldestOpenReviewHours: number;
  engagementGap: number;
  overdueSectionCount: number;
}): { level: RiskLevel; score: number } {
  let score = 0;

  if (signals.openClarifications > 0) score += 1;
  if (signals.oldestOpenReviewHours > REVIEW_STALE_HOURS) score += 2;
  if (signals.engagementGap > 0) score += 1;
  if (signals.overdueSectionCount > 0) score += 1;

  if (score >= 3) return { level: "high", score };
  if (score >= 1) return { level: "medium", score };
  return { level: "low", score };
}

/** GET /api/dashboard — Persona-aware operations dashboard payload */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const persona = normalizePersona(searchParams.get("persona"));

  const projects = await prisma.project.findMany({
    where: {
      status: { in: [...ACTIVE_PROJECT_STATUSES] },
    },
    include: {
      commercialOwner: true,
      jurisdictions: { include: { jurisdiction: true } },
      sectionStates: { include: { section: true } },
      reviews: {
        include: {
          reviewer: { include: { user: true } },
          clarifications: true,
          threads: { include: { comments: true } },
        },
      },
      delegations: {
        include: {
          assignee: true,
          threads: { include: { comments: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const sectionBottlenecks = new Map<
    string,
    { section: string; drafting: number; released: number; underReview: number; cleared: number; overdue: number }
  >();
  const jurisdictionCoverage = new Map<string, { jurisdiction: string; projects: number; withReviewerCoverage: number }>();
  const reviewCycleHours: number[] = [];
  const activity: ActivityEvent[] = [];

  const projectRows = projects.map((project) => {
    const expectedResponderIds = new Set<string>();
    const engagedResponderIds = new Set<string>();
    const respondedReviewIds = new Set<string>();
    const reviewerRegions = new Set<string>();

    let openClarifications = 0;
    let openReviews = 0;
    let oldestOpenReviewHours = 0;

    for (const review of project.reviews) {
      expectedResponderIds.add(review.reviewer.userId);
      for (const region of jsonToStringArray(review.reviewer.jurisdictions)) {
        reviewerRegions.add(region);
      }

      const reviewHasThreadActivity = review.threads.some((thread) => thread.comments.length > 0);
      const reviewHasClarification = review.clarifications.length > 0;
      const reviewEngaged = review.status !== "open" || reviewHasThreadActivity || reviewHasClarification;

      if (reviewEngaged) {
        engagedResponderIds.add(review.reviewer.userId);
      }

      if (review.status !== "disposed") {
        openReviews += 1;
        oldestOpenReviewHours = Math.max(oldestOpenReviewHours, toHoursSince(review.openedAt));
      }

      if (review.status === "disposed") {
        respondedReviewIds.add(review.id);
        if (review.closedAt) {
          reviewCycleHours.push((review.closedAt.getTime() - review.openedAt.getTime()) / (1000 * 60 * 60));
        }
      }

      for (const clarification of review.clarifications) {
        if (clarification.status !== "resolved") {
          openClarifications += 1;
        }

        activity.push({
          timestamp: clarification.openedAt.toISOString(),
          projectId: project.id,
          projectName: project.name,
          type: "clarification_opened",
          message: `${review.domain} opened a clarification`,
        });

        if (clarification.resolvedAt) {
          activity.push({
            timestamp: clarification.resolvedAt.toISOString(),
            projectId: project.id,
            projectName: project.name,
            type: "clarification_resolved",
            message: `${review.domain} clarification resolved`,
          });
        }
      }

      activity.push({
        timestamp: review.openedAt.toISOString(),
        projectId: project.id,
        projectName: project.name,
        type: "review_opened",
        message: `${review.domain} review opened`,
      });

      if (review.closedAt) {
        activity.push({
          timestamp: review.closedAt.toISOString(),
          projectId: project.id,
          projectName: project.name,
          type: "review_disposed",
          message: `${review.domain} review disposed (${review.disposition ?? "no disposition"})`,
        });
      }
    }

    for (const delegation of project.delegations) {
      expectedResponderIds.add(delegation.assigneeId);
      if (delegation.status !== "pending" || delegation.threads.some((thread) => thread.comments.length > 0)) {
        engagedResponderIds.add(delegation.assigneeId);
      }

      activity.push({
        timestamp: delegation.createdAt.toISOString(),
        projectId: project.id,
        projectName: project.name,
        type: "delegation_created",
        message: `Delegation sent to ${delegation.assignee.name}`,
      });
    }

    for (const sectionState of project.sectionStates) {
      const key = sectionState.section.slug;
      const entry =
        sectionBottlenecks.get(key) ??
        {
          section: sectionState.section.displayName,
          drafting: 0,
          released: 0,
          underReview: 0,
          cleared: 0,
          overdue: 0,
        };

      if (sectionState.state === "drafting") entry.drafting += 1;
      if (sectionState.state === "released") entry.released += 1;
      if (sectionState.state === "under_review") {
        entry.underReview += 1;
        const hoursSinceRelease = toHoursSince(sectionState.releasedAt);
        if (hoursSinceRelease > REVIEW_STALE_HOURS) {
          entry.overdue += 1;
        }
      }
      if (sectionState.state === "cleared") entry.cleared += 1;

      sectionBottlenecks.set(key, entry);
    }

    for (const pj of project.jurisdictions) {
      const key = pj.jurisdiction.code;
      const entry =
        jurisdictionCoverage.get(key) ?? {
          jurisdiction: pj.jurisdiction.name,
          projects: 0,
          withReviewerCoverage: 0,
        };
      entry.projects += 1;
      if (reviewerRegions.has(pj.jurisdiction.code) || reviewerRegions.has(pj.jurisdiction.name)) {
        entry.withReviewerCoverage += 1;
      }
      jurisdictionCoverage.set(key, entry);
    }

    if (project.submittedAt) {
      activity.push({
        timestamp: project.submittedAt.toISOString(),
        projectId: project.id,
        projectName: project.name,
        type: "project_submitted",
        message: "Project submitted for review",
      });
    }

    const totalSections = project.sectionStates.length;
    const clearedSections = project.sectionStates.filter((s) => s.state === "cleared").length;
    const underReviewSections = project.sectionStates.filter((s) => s.state === "under_review").length;
    const overdueSectionCount = project.sectionStates.filter(
      (s) => s.state === "under_review" && toHoursSince(s.releasedAt) > REVIEW_STALE_HOURS
    ).length;

    const expectedResponders = expectedResponderIds.size;
    const engagedResponders = engagedResponderIds.size;
    const engagementGap = Math.max(0, expectedResponders - engagedResponders);

    const risk = riskFromSignals({
      openClarifications,
      oldestOpenReviewHours,
      engagementGap,
      overdueSectionCount,
    });

    const sectionCompletion = totalSections > 0 ? (clearedSections / totalSections) * 100 : 0;

    const dateCandidates = [project.createdAt, project.submittedAt]
      .concat(project.reviews.flatMap((r) => [r.openedAt, r.closedAt]))
      .concat(project.reviews.flatMap((r) => r.clarifications.flatMap((c) => [c.openedAt, c.resolvedAt])))
      .concat(project.delegations.map((d) => d.createdAt))
      .filter((date): date is Date => Boolean(date));

    const lastActivityAt =
      dateCandidates.length > 0
        ? new Date(Math.max(...dateCandidates.map((d) => d.getTime()))).toISOString()
        : project.createdAt.toISOString();

    return {
      id: project.id,
      name: project.name,
      status: project.status,
      scopeType: project.scopeType,
      owner: { id: project.commercialOwner.id, name: project.commercialOwner.name },
      jurisdictionCount: project.jurisdictions.length,
      jurisdictions: project.jurisdictions.map((j) => ({ code: j.jurisdiction.code, name: j.jurisdiction.name })),
      expectedResponders,
      engagedResponders,
      respondedReviews: respondedReviewIds.size,
      openReviews,
      openClarifications,
      sectionCompletion: Math.round(sectionCompletion),
      clearedSections,
      totalSections,
      underReviewSections,
      overdueSectionCount,
      oldestOpenReviewHours: Math.round(oldestOpenReviewHours),
      riskLevel: risk.level,
      riskScore: risk.score,
      engagementGap,
      createdAt: project.createdAt.toISOString(),
      submittedAt: project.submittedAt?.toISOString() ?? null,
      lastActivityAt,
    };
  });

  const orderedRows = [...projectRows].sort((a, b) => {
    if (persona === "commercial_owner") {
      return b.riskScore - a.riskScore || b.openClarifications - a.openClarifications;
    }
    if (persona === "reviewer") {
      return b.openReviews - a.openReviews || b.overdueSectionCount - a.overdueSectionCount;
    }
    if (persona === "collaborator") {
      return b.engagementGap - a.engagementGap || b.underReviewSections - a.underReviewSections;
    }
    return b.totalSections - a.totalSections;
  });

  const summary = {
    inProgressProjects: projectRows.length,
    awaitingOwner: projectRows.filter((p) => p.openClarifications > 0).length,
    awaitingReviewer: projectRows.filter((p) => p.openReviews > 0).length,
    atRisk: projectRows.filter((p) => p.riskLevel === "high").length,
    medianReviewCycleHours: Math.round(percentile50(reviewCycleHours)),
  };

  const response = {
    persona,
    generatedAt: new Date().toISOString(),
    summary,
    projects: orderedRows,
    bottlenecks: {
      sections: [...sectionBottlenecks.values()]
        .map((section) => ({
          ...section,
          pressure: clamp(section.underReview * 2 + section.overdue * 3 + section.released, 0, 99),
        }))
        .sort((a, b) => b.pressure - a.pressure)
        .slice(0, 8),
      jurisdictions: [...jurisdictionCoverage.values()]
        .map((j) => ({
          ...j,
          coveragePct: j.projects > 0 ? Math.round((j.withReviewerCoverage / j.projects) * 100) : 0,
        }))
        .sort((a, b) => a.coveragePct - b.coveragePct)
        .slice(0, 8),
    },
    activity: activity.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)).slice(0, 30),
    notes: {
      engagementDefinition:
        "Engaged responders are reviewers/delegates with non-open status, clarification activity, or thread comments.",
      viewTracking:
        "Explicit view telemetry is not yet instrumented; engagement is used as a proxy until view events are added.",
      staleReviewThresholdHours: REVIEW_STALE_HOURS,
    },
  };

  return NextResponse.json(response);
}
