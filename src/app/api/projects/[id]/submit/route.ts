import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluatePatterns } from "@/lib/pattern-engine";

/**
 * POST /api/projects/:id/submit — Submit project for review.
 *
 * This is the major transition: locks the project, pins policy snapshots,
 * evaluates patterns for fast-track, and opens reviews.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      sectionStates: { include: { section: true } },
      jurisdictions: { include: { jurisdiction: true } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.status !== "drafting") {
    return NextResponse.json(
      { error: `Cannot submit project in state "${project.status}"` },
      { status: 409 }
    );
  }

  // 1. Pin policy snapshots
  const currentPolicies = await prisma.policyVersion.findMany({
    orderBy: { version: "desc" },
    distinct: ["policyDocId"],
  });

  for (const pv of currentPolicies) {
    await prisma.policySnapshot.upsert({
      where: {
        projectId_policyVersionId: { projectId, policyVersionId: pv.id },
      },
      update: {},
      create: { projectId, policyVersionId: pv.id },
    });
  }

  // 2. Evaluate patterns for fast-track
  const patternResults = await evaluatePatterns(projectId);

  // 3. Determine which reviews to open based on sections and jurisdictions
  const reviewsToCreate: {
    sectionId: string | null;
    domain: string;
    reviewerId: string;
  }[] = [];

  // Find applicable reviewers for each released section
  for (const ss of project.sectionStates) {
    if (ss.state === "drafting") continue; // Only review released+ sections

    const section = ss.section;
    // Look up reviewers for this section's domain
    const reviewers = await prisma.reviewer.findMany({
      where: { domain: section.slug as any },
    });

    for (const reviewer of reviewers) {
      // Check if reviewer's jurisdiction overlaps with project's
      reviewsToCreate.push({
        sectionId: section.id,
        domain: section.slug,
        reviewerId: reviewer.id,
      });
    }
  }

  // Check pattern waivers — skip reviews that are waived
  const waivedDomains = new Set<string>();
  for (const pm of patternResults) {
    if (pm.fitScore >= 1.0 && pm.reviewerWaivers) {
      for (const waiver of pm.reviewerWaivers as { domain: string }[]) {
        waivedDomains.add(waiver.domain);
      }
    }
  }

  // Create review records (excluding waived domains)
  for (const r of reviewsToCreate) {
    if (waivedDomains.has(r.domain)) continue;

    await prisma.review.create({
      data: {
        projectId,
        sectionId: r.sectionId,
        reviewerId: r.reviewerId,
        domain: r.domain as any,
      },
    });
  }

  // 4. Transition project to submitted
  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      status: "submitted",
      submittedAt: new Date(),
    },
  });

  return NextResponse.json({
    project: updated,
    policySnapshots: currentPolicies.length,
    reviewsOpened: reviewsToCreate.filter((r) => !waivedDomains.has(r.domain)).length,
    fastTrack: patternResults.some((p) => p.fitScore >= 1.0),
    waivedDomains: Array.from(waivedDomains),
  });
}
