export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

interface FeedActor {
  id: string;
  name: string;
  email: string;
}

interface FeedItem {
  id: string;
  kind: "comment" | "answer" | "review" | "clarification" | "delegation";
  actor: FeedActor;
  questionSlug: string | null;
  sectionSlug: string | null;
  domain?: string;
  jurisdictions?: string[];
  summary: string;
  body?: string;
  timestamp: string;
}

/**
 * GET /api/projects/:id/activity?type=collaboration|reviewer&section=<slug>
 *
 * Returns project-wide activity for the requested actor class, with facet
 * counts for the right-panel filter rails.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const { id: projectId } = await params;
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") || "collaboration") as "collaboration" | "reviewer";
  const sectionSlug = searchParams.get("section");

  // Project-scoped IDs we'll need to walk threads
  const [answers, reviews, clarifications, delegations] = await Promise.all([
    prisma.answer.findMany({
      where: { projectId },
      select: {
        id: true,
        source: true,
        attester: { select: { id: true, name: true, email: true } },
        attestedBy: true,
        answeredAt: true,
        questionVersion: {
          select: {
            question: {
              select: { slug: true, section: { select: { slug: true } } },
            },
          },
        },
      },
    }),
    prisma.review.findMany({
      where: { projectId },
      select: {
        id: true,
        domain: true,
        sectionId: true,
        section: { select: { slug: true } },
        reviewer: {
          select: {
            id: true,
            jurisdictions: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
        disposition: true,
        openedAt: true,
      },
    }),
    prisma.clarification.findMany({
      where: { review: { projectId } },
      select: {
        id: true,
        status: true,
        openedAt: true,
        review: {
          select: {
            domain: true,
            reviewer: {
              select: {
                jurisdictions: true,
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
        answer: {
          select: {
            questionVersion: {
              select: {
                question: { select: { slug: true, section: { select: { slug: true } } } },
              },
            },
          },
        },
      },
    }),
    prisma.delegation.findMany({
      where: { projectId },
      select: {
        id: true,
        scopeType: true,
        scopeTarget: true,
        status: true,
        createdAt: true,
        assigner: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  const answerToQuestion = new Map(
    answers.map((a) => [
      a.id,
      {
        questionSlug: a.questionVersion?.question?.slug ?? null,
        sectionSlug: a.questionVersion?.question?.section?.slug ?? null,
      },
    ])
  );
  const reviewToContext = new Map(
    reviews.map((r) => [
      r.id,
      {
        domain: r.domain,
        sectionSlug: r.section?.slug ?? null,
        jurisdictions: extractJurisdictions(r.reviewer.jurisdictions),
      },
    ])
  );

  const collaboratorIds = new Set(delegations.map((d) => d.assignee.id));

  const threads = await prisma.thread.findMany({
    where: {
      OR: [
        { answerId: { in: answers.map((a) => a.id) } },
        { reviewId: { in: reviews.map((r) => r.id) } },
        { clarificationId: { in: clarifications.map((c) => c.id) } },
        { delegationId: { in: delegations.map((d) => d.id) } },
      ],
    },
    select: {
      id: true,
      parentType: true,
      answerId: true,
      reviewId: true,
      clarificationId: true,
      delegationId: true,
    },
  });

  const threadContext = new Map<string, { questionSlug: string | null; sectionSlug: string | null; domain?: string; jurisdictions?: string[] }>();
  for (const t of threads) {
    if (t.answerId && answerToQuestion.has(t.answerId)) {
      threadContext.set(t.id, answerToQuestion.get(t.answerId)!);
    } else if (t.reviewId && reviewToContext.has(t.reviewId)) {
      const r = reviewToContext.get(t.reviewId)!;
      threadContext.set(t.id, {
        questionSlug: null,
        sectionSlug: r.sectionSlug,
        domain: r.domain,
        jurisdictions: r.jurisdictions,
      });
    } else if (t.clarificationId) {
      const c = clarifications.find((x) => x.id === t.clarificationId);
      const ctx = c
        ? {
            questionSlug: c.answer?.questionVersion?.question?.slug ?? null,
            sectionSlug: c.answer?.questionVersion?.question?.section?.slug ?? null,
            domain: c.review.domain,
            jurisdictions: extractJurisdictions(c.review.reviewer.jurisdictions),
          }
        : { questionSlug: null, sectionSlug: null };
      threadContext.set(t.id, ctx);
    } else if (t.delegationId) {
      threadContext.set(t.id, { questionSlug: null, sectionSlug: null });
    }
  }

  const comments = await prisma.comment.findMany({
    where: { threadId: { in: threads.map((t) => t.id) } },
    include: { author: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  const items: FeedItem[] = [];

  if (type === "collaboration") {
    // Comments authored by collaborators
    for (const c of comments) {
      if (!collaboratorIds.has(c.authorId)) continue;
      const ctx = threadContext.get(c.threadId) ?? { questionSlug: null, sectionSlug: null };
      items.push({
        id: c.id,
        kind: "comment",
        actor: c.author,
        questionSlug: ctx.questionSlug,
        sectionSlug: ctx.sectionSlug,
        body: c.body,
        summary: `commented${ctx.questionSlug ? ` on ${ctx.questionSlug}` : ""}`,
        timestamp: c.createdAt.toISOString(),
      });
    }
    // Collaborator-supplied answers
    for (const a of answers) {
      if (a.source !== "collaborator_supplied") continue;
      if (!a.attester) continue;
      const ctx = answerToQuestion.get(a.id)!;
      items.push({
        id: a.id,
        kind: "answer",
        actor: a.attester,
        questionSlug: ctx.questionSlug,
        sectionSlug: ctx.sectionSlug,
        summary: `answered ${ctx.questionSlug ?? ""}`.trim(),
        timestamp: (a.answeredAt ?? new Date()).toISOString(),
      });
    }
  } else {
    // Reviewer activity
    const reviewerUserIds = new Set(reviews.map((r) => r.reviewer.user.id));

    for (const c of comments) {
      if (!reviewerUserIds.has(c.authorId)) continue;
      const ctx = threadContext.get(c.threadId) ?? { questionSlug: null, sectionSlug: null };
      items.push({
        id: c.id,
        kind: "comment",
        actor: c.author,
        questionSlug: ctx.questionSlug,
        sectionSlug: ctx.sectionSlug,
        domain: ctx.domain,
        jurisdictions: ctx.jurisdictions,
        body: c.body,
        summary: `commented${ctx.questionSlug ? ` on ${ctx.questionSlug}` : ""}`,
        timestamp: c.createdAt.toISOString(),
      });
    }
    for (const r of reviews) {
      const ctx = reviewToContext.get(r.id)!;
      items.push({
        id: r.id,
        kind: "review",
        actor: r.reviewer.user,
        questionSlug: null,
        sectionSlug: ctx.sectionSlug,
        domain: r.domain,
        jurisdictions: ctx.jurisdictions,
        summary: r.disposition
          ? `disposed ${r.domain}: ${r.disposition}`
          : `opened ${r.domain} review`,
        timestamp: r.openedAt.toISOString(),
      });
    }
    for (const c of clarifications) {
      const ctx = c.answer
        ? {
            questionSlug: c.answer.questionVersion?.question?.slug ?? null,
            sectionSlug: c.answer.questionVersion?.question?.section?.slug ?? null,
          }
        : { questionSlug: null, sectionSlug: null };
      items.push({
        id: c.id,
        kind: "clarification",
        actor: c.review.reviewer.user,
        questionSlug: ctx.questionSlug,
        sectionSlug: ctx.sectionSlug,
        domain: c.review.domain,
        jurisdictions: extractJurisdictions(c.review.reviewer.jurisdictions),
        summary: `${c.status === "open" ? "opened" : c.status} clarification${
          ctx.questionSlug ? ` on ${ctx.questionSlug}` : ""
        }`,
        timestamp: c.openedAt.toISOString(),
      });
    }
  }

  // Section scope filter — applied to items, not to facets, so users still see
  // total counts even when scoped.
  const allItems = items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const visibleItems = sectionSlug
    ? allItems.filter((i) => i.sectionSlug === sectionSlug)
    : allItems;

  // Facets — counted against scoped items so the rail reflects what's shown
  const facets =
    type === "collaboration"
      ? buildCollaborationFacets(visibleItems)
      : buildReviewerFacets(visibleItems);

  return NextResponse.json({
    type,
    scope: sectionSlug ? "section" : "project",
    sectionSlug: sectionSlug ?? null,
    items: visibleItems,
    totalAll: allItems.length,
    totalScoped: visibleItems.length,
    facets,
  });
}

function extractJurisdictions(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === "string" ? v : String(v)));
  }
  if (typeof value === "object" && value !== null && "codes" in value) {
    const codes = (value as { codes?: unknown }).codes;
    if (Array.isArray(codes)) return codes.map(String);
  }
  return [];
}

function buildCollaborationFacets(items: FeedItem[]) {
  const byAuthorMap = new Map<string, { id: string; name: string; email: string; count: number }>();
  for (const i of items) {
    const cur = byAuthorMap.get(i.actor.id) ?? { ...i.actor, count: 0 };
    cur.count += 1;
    byAuthorMap.set(i.actor.id, cur);
  }
  const byAuthor = [...byAuthorMap.values()].sort((a, b) => b.count - a.count);
  return { byAuthor };
}

function buildReviewerFacets(items: FeedItem[]) {
  const byDomainMap = new Map<string, number>();
  const byJurisdictionMap = new Map<string, number>();
  for (const i of items) {
    if (i.domain) {
      byDomainMap.set(i.domain, (byDomainMap.get(i.domain) ?? 0) + 1);
    }
    for (const j of i.jurisdictions ?? []) {
      byJurisdictionMap.set(j, (byJurisdictionMap.get(j) ?? 0) + 1);
    }
  }
  return {
    byDomain: [...byDomainMap.entries()]
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count),
    byJurisdiction: [...byJurisdictionMap.entries()]
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count),
  };
}
