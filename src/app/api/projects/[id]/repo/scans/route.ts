import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  runQuestionPrepopulationScan,
  runReviewerRiskScan,
  runTechnicalDescriptionScan,
} from "@/lib/ingestion";
import type { RepoScanKind } from "@/generated/prisma/client";

export const runtime = "nodejs";

const SCAN_KINDS: RepoScanKind[] = [
  "technical_description",
  "reviewer_risk_review",
  "question_prepopulation",
];

function isScanKind(value: unknown): value is RepoScanKind {
  return typeof value === "string" && (SCAN_KINDS as string[]).includes(value);
}

/**
 * GET /api/projects/:id/repo/scans
 * Returns the latest run for each kind (succeeded, failed, or running).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const runs = await Promise.all(
    SCAN_KINDS.map((kind) =>
      prisma.repoScanRun.findFirst({
        where: { projectId, kind },
        orderBy: { startedAt: "desc" },
      })
    )
  );

  return NextResponse.json({
    runs: SCAN_KINDS.reduce(
      (acc, kind, i) => {
        acc[kind] = runs[i] ?? null;
        return acc;
      },
      {} as Record<RepoScanKind, unknown>
    ),
  });
}

/**
 * POST /api/projects/:id/repo/scans
 * Body shapes:
 *   - `{}` or no body  → run all three kinds sequentially.
 *   - `{ kind: RepoScanKind }`     → run that single kind.
 *   - `{ kinds: RepoScanKind[] }`  → run that subset, in the given order.
 *
 * Failure of one does not block the others; each run is captured on its own
 * RepoScanRun row.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, repoUrl: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!project.repoUrl) {
    return NextResponse.json(
      { error: "No repo URL set on this project" },
      { status: 400 }
    );
  }

  // Crash-safety sweep: any run still status=running after 60 minutes is
  // almost certainly orphaned (dev server killed mid-loop, pod evicted, etc).
  // Mark them failed so the UI doesn't hang forever and the next "Run all"
  // doesn't pile up indefinitely.
  const STALE_AFTER_MS = 60 * 60 * 1000;
  await prisma.repoScanRun.updateMany({
    where: {
      projectId,
      status: "running",
      startedAt: { lt: new Date(Date.now() - STALE_AFTER_MS) },
    },
    data: {
      status: "failed",
      errorMessage: "Process died or was killed before completion",
      finishedAt: new Date(),
    },
  });

  const body = await req.json().catch(() => ({}));
  const ctx = { projectId, triggeredBy: null };

  // Resolve which kinds to run.
  let kindsToRun: RepoScanKind[];
  if (Array.isArray(body?.kinds)) {
    if (!body.kinds.every(isScanKind)) {
      return NextResponse.json(
        {
          error: `Invalid kinds. Expected an array of ${SCAN_KINDS.join(", ")}.`,
        },
        { status: 400 }
      );
    }
    kindsToRun = body.kinds;
  } else if (body?.kind !== undefined && body.kind !== null) {
    if (!isScanKind(body.kind)) {
      return NextResponse.json(
        { error: `Invalid kind. Expected one of ${SCAN_KINDS.join(", ")}.` },
        { status: 400 }
      );
    }
    kindsToRun = [body.kind];
  } else {
    kindsToRun = SCAN_KINDS;
  }

  const runs = [];
  for (const kind of kindsToRun) {
    if (kind === "technical_description") {
      runs.push(await runTechnicalDescriptionScan(ctx));
    } else if (kind === "reviewer_risk_review") {
      runs.push(await runReviewerRiskScan(ctx));
    } else {
      runs.push(await runQuestionPrepopulationScan(ctx));
    }
  }
  return NextResponse.json({ runs });
}
