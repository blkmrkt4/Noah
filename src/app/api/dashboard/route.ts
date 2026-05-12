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

type ReviewerActivityItem = {
  reviewId: string;
  reviewerName: string;
  domain: string;
  sectionName: string | null;
  isCriticalPath: boolean;
  advisoryDeadline: string | null;
  signal: "red" | "yellow" | "green";
  lastAction: {
    type: "viewed" | "commented" | "clarification_opened" | "clarification_resolved" | "delegated" | "disposed" | "none";
    at: string | null;
  };
  disposition: string | null;
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
  try {
  const { searchParams } = new URL(req.url);
  const persona = normalizePersona(searchParams.get("persona"));

  // Fetch base projects first (lightweight), then use IDs for parallel sub-queries.
  // Avoids one massive nested include that overwhelms the Prisma Postgres dev server.
  const projectsBase = await prisma.project.findMany({
    where: { status: { in: [...ACTIVE_PROJECT_STATUSES] } },
    include: {
      commercialOwner: true,
      jurisdictions: { include: { jurisdiction: true } },
      sectionStates: { include: { section: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const projectIds = projectsBase.map((p) => p.id);

  const [allReviews, allDelegations, answerRows] = await Promise.all([
    prisma.review.findMany({
      where: { projectId: { in: projectIds } },
      include: {
        reviewer: { include: { user: true } },
        section: true,
        clarifications: true,
        threads: { include: { comments: true } },
      },
    }),
    prisma.delegation.findMany({
      where: { projectId: { in: projectIds } },
      include: {
        assignee: true,
        threads: { include: { comments: true } },
      },
    }),
    prisma.answer.findMany({
      where: { projectId: { in: projectIds } },
      select: {
        id: true,
        projectId: true,
        threads: { select: { comments: { select: { id: true } } } },
        clarifications: { select: { id: true } },
      },
    }),
  ]);

  // Index by projectId
  const reviewsByProject = new Map<string, typeof allReviews>();
  for (const r of allReviews) {
    const list = reviewsByProject.get(r.projectId) ?? [];
    list.push(r);
    reviewsByProject.set(r.projectId, list);
  }
  const delegationsByProject = new Map<string, typeof allDelegations>();
  for (const d of allDelegations) {
    const list = delegationsByProject.get(d.projectId) ?? [];
    list.push(d);
    delegationsByProject.set(d.projectId, list);
  }
  const answersByProject = new Map<string, typeof answerRows>();
  for (const a of answerRows) {
    const list = answersByProject.get(a.projectId) ?? [];
    list.push(a);
    answersByProject.set(a.projectId, list);
  }

  // Reassemble with full typed relations
  const projects = projectsBase.map((p) => ({
    ...p,
    reviews: reviewsByProject.get(p.id) ?? [] as typeof allReviews,
    delegations: delegationsByProject.get(p.id) ?? [] as typeof allDelegations,
    answers: answersByProject.get(p.id) ?? [] as typeof answerRows,
  }));

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

    // Build per-reviewer activity for expandable dashboard rows
    const now = new Date();
    const reviewerActivity: ReviewerActivityItem[] = project.reviews.map((review) => {
      // Determine the most recent action and its timestamp
      const actionCandidates: { type: ReviewerActivityItem["lastAction"]["type"]; at: Date }[] = [];

      if (review.lastViewedAt) {
        actionCandidates.push({ type: "viewed", at: review.lastViewedAt });
      }
      if (review.closedAt) {
        actionCandidates.push({ type: "disposed", at: review.closedAt });
      }
      for (const thread of review.threads) {
        for (const comment of thread.comments) {
          actionCandidates.push({ type: "commented", at: comment.createdAt });
        }
      }
      for (const clarification of review.clarifications) {
        actionCandidates.push({ type: "clarification_opened", at: clarification.openedAt });
        if (clarification.resolvedAt) {
          actionCandidates.push({ type: "clarification_resolved", at: clarification.resolvedAt });
        }
      }

      actionCandidates.sort((a, b) => b.at.getTime() - a.at.getTime());
      const latestAction = actionCandidates[0] ?? null;

      // Compute signal color
      let signal: "red" | "yellow" | "green";
      if (review.status === "disposed") {
        signal = "green";
      } else if (!review.isCriticalPath) {
        if (review.advisoryDeadline && review.advisoryDeadline <= now) {
          signal = "green"; // deadline passed, silence = permissible
        } else {
          signal = "yellow";
        }
      } else {
        signal = "red"; // critical-path, not yet disposed
      }

      return {
        reviewId: review.id,
        reviewerName: review.reviewer.user.name,
        domain: review.domain,
        sectionName: review.section?.displayName ?? null,
        isCriticalPath: review.isCriticalPath,
        advisoryDeadline: review.advisoryDeadline?.toISOString() ?? null,
        signal,
        lastAction: {
          type: latestAction?.type ?? "none",
          at: latestAction?.at.toISOString() ?? null,
        },
        disposition: review.disposition ?? null,
      };
    });

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
      reviewerActivity,
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

  // ── Staleness / attention-required metrics ──────────────────────────────
  const now = new Date();
  const DAYS_MS = 1000 * 60 * 60 * 24;

  // Cases where no reviewer has done anything in 14+ days
  const staleCases14d = projects.filter((project) => {
    if (project.reviews.length === 0) return false;
    const latestReviewerAction = Math.max(
      ...project.reviews.map((r) => {
        const dates: number[] = [r.openedAt.getTime()];
        if (r.lastViewedAt) dates.push(r.lastViewedAt.getTime());
        if (r.closedAt) dates.push(r.closedAt.getTime());
        for (const c of r.clarifications) {
          dates.push(c.openedAt.getTime());
          if (c.resolvedAt) dates.push(c.resolvedAt.getTime());
        }
        for (const t of r.threads) {
          for (const cm of t.comments) dates.push(cm.createdAt.getTime());
        }
        return Math.max(...dates);
      })
    );
    return (now.getTime() - latestReviewerAction) > 14 * DAYS_MS;
  });

  // Questions (answers) with zero reviewer comments and no sign-off on any review
  let untouchedQuestions = 0;
  for (const project of projects) {
    const disposedReviewIds = new Set(
      project.reviews.filter((r) => r.status === "disposed").map((r) => r.id)
    );
    for (const answer of project.answers) {
      const hasReviewerComment = answer.threads.some((t) => t.comments.length > 0);
      const hasClarification = answer.clarifications.length > 0;
      if (!hasReviewerComment && !hasClarification) {
        untouchedQuestions += 1;
      }
    }
  }

  // Delegations pending for 7+ days with no response
  let staleDelegations = 0;
  for (const project of projects) {
    for (const delegation of project.delegations) {
      if (delegation.status === "pending" && (now.getTime() - delegation.createdAt.getTime()) > 7 * DAYS_MS) {
        staleDelegations += 1;
      }
    }
  }

  // Cases by age bucket
  const ageBuckets = { over60: 0, over90: 0, over120: 0 };
  for (const project of projects) {
    const ageDays = (now.getTime() - project.createdAt.getTime()) / DAYS_MS;
    if (ageDays > 120) { ageBuckets.over120 += 1; ageBuckets.over90 += 1; ageBuckets.over60 += 1; }
    else if (ageDays > 90) { ageBuckets.over90 += 1; ageBuckets.over60 += 1; }
    else if (ageDays > 60) { ageBuckets.over60 += 1; }
  }

  const attentionRequired = {
    staleCases14d: staleCases14d.map((p) => ({ id: p.id, name: p.name })),
    untouchedQuestions,
    staleDelegations,
    ageBuckets,
  };

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
    attentionRequired,
    activity: activity.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)).slice(0, 30),
    notes: {
      engagementDefinition:
        "Engaged responders are reviewers/delegates with non-open status, clarification activity, or thread comments.",
      viewTracking:
        "Review view telemetry is tracked via lastViewedAt on each Review. Advisory reviews auto-green after their deadline.",
      staleReviewThresholdHours: REVIEW_STALE_HOURS,
    },
  };

  return NextResponse.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const stack = err instanceof Error ? err.stack : "";
    console.error("[dashboard] Error:", message, stack);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
