import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invokeBind } from "@/lib/openrouter";

const SCAN_BIND_SLUG = "policy-more-info-extract";
const CONCURRENCY = 3;

/**
 * POST /api/scans
 *
 * Runs a scan over the supplied questionVersionIds. For each question, the
 * input set of policies is:
 *   (all policies bound to the question's section via PolicyDocSection)
 *     minus
 *   (policies the question has explicitly excluded via QuestionPolicyExclusion)
 * If policyDocId is supplied, the input is further restricted to that one
 * policy — used by the section-level scan affordance which fires one request
 * per policy so each policy gets its own PolicyScanRun and progress row.
 *
 * One LLM call per (questionVersion, policyVersion) pair — each produces an
 * independent QuestionMoreInfo draft. The author merges drafts in the editor;
 * the published snippet (sourcePolicy = null) is composed there.
 *
 * Body: { questionVersionIds: string[], triggeredById: string, policyDocId?: string }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { questionVersionIds, triggeredById, policyDocId } = body as {
    questionVersionIds?: string[];
    triggeredById?: string;
    policyDocId?: string;
  };

  if (!Array.isArray(questionVersionIds) || questionVersionIds.length === 0) {
    return NextResponse.json(
      { error: "questionVersionIds must be a non-empty array" },
      { status: 400 }
    );
  }
  if (!triggeredById) {
    return NextResponse.json(
      { error: "triggeredById is required" },
      { status: 400 }
    );
  }

  const scanRun = await prisma.policyScanRun.create({
    data: {
      triggeredById,
      scope: { questionVersionIds, policyDocId: policyDocId ?? null },
    },
  });

  let produced = 0;

  try {
    const versions = await prisma.questionVersion.findMany({
      where: { id: { in: questionVersionIds } },
      include: {
        question: {
          include: {
            section: {
              include: {
                policyBindings: {
                  include: {
                    policyDoc: {
                      include: {
                        versions: { orderBy: { version: "desc" }, take: 1 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        policyExclusions: {
          select: { policyDocId: true },
        },
      },
    });

    type Job = {
      qv: (typeof versions)[number];
      policyDocId: string;
      policyTitle: string;
      latestVersion: { id: string; version: number; content: string };
    };

    const jobs: Job[] = [];
    for (const qv of versions) {
      // Questions that have opted out of guidance (e.g., "name your product")
      // should never produce drafts, even if requested in the scan scope.
      if (!qv.question.guidanceRequired) continue;
      const excludedPolicyIds = new Set(
        qv.policyExclusions.map((e) => e.policyDocId)
      );
      for (const binding of qv.question.section.policyBindings) {
        if (policyDocId && binding.policyDocId !== policyDocId) continue;
        if (excludedPolicyIds.has(binding.policyDocId)) continue;
        const latest = binding.policyDoc.versions[0];
        if (!latest) continue;
        jobs.push({
          qv,
          policyDocId: binding.policyDocId,
          policyTitle: binding.policyDoc.title,
          latestVersion: latest,
        });
      }
    }

    const errors: { questionVersionId: string; policyDocId: string; message: string }[] = [];

    async function runJob(job: Job): Promise<void> {
      try {
        const snippet = await invokeBind(SCAN_BIND_SLUG, {
          question_prompt: job.qv.prompt,
          question_slug: job.qv.question.slug,
          section_name: job.qv.question.section.displayName,
          policy_title: job.policyTitle,
          policy_text: job.latestVersion.content,
        });
        await prisma.questionMoreInfo.create({
          data: {
            questionVersionId: job.qv.id,
            sourcePolicyVersionId: job.latestVersion.id,
            body: snippet.trim(),
            status: "pending_review",
            scanRunId: scanRun.id,
          },
        });
        produced++;
      } catch (e) {
        const message = (e as Error).message ?? "unknown";
        errors.push({
          questionVersionId: job.qv.id,
          policyDocId: job.policyDocId,
          message,
        });
        // A missing/misconfigured bind is fatal — propagate so the user gets a
        // clear error instead of every job silently failing.
        if (message.includes("No ActivityBind")) {
          throw e;
        }
      }
    }

    // Run jobs with bounded concurrency.
    const queue = [...jobs];
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length > 0) {
        const next = queue.shift();
        if (!next) return;
        await runJob(next);
      }
    });
    await Promise.all(workers);

    await prisma.policyScanRun.update({
      where: { id: scanRun.id },
      data: {
        completedAt: new Date(),
        itemsProduced: produced,
        errorMessage:
          errors.length > 0
            ? `${errors.length} job(s) failed: ${errors[0].message}`
            : null,
      },
    });

    return NextResponse.json(
      { scanRunId: scanRun.id, itemsProduced: produced, errors },
      { status: 201 }
    );
  } catch (e) {
    await prisma.policyScanRun.update({
      where: { id: scanRun.id },
      data: {
        completedAt: new Date(),
        itemsProduced: produced,
        errorMessage: (e as Error).message,
      },
    });
    return NextResponse.json(
      { error: (e as Error).message, scanRunId: scanRun.id, itemsProduced: produced },
      { status: 500 }
    );
  }
}
