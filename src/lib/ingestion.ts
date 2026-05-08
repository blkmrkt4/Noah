/**
 * Ingestion Pipeline — processes documents and repos to pre-populate answers.
 *
 * LLM model + prompt come from /admin (ActivityBind slugs):
 *   - doc-extraction
 *   - repo-scan
 *   - answer-prepopulation
 *   - repo-scan-technical          (Phase 3 — produces structured tech description)
 *   - repo-scan-risk-review        (Phase 3 — produces plain-English reviewer doc)
 *
 * Three stages:
 * 1. Document extraction → DocExtraction rows
 * 2. Repo scanning → RepoFinding rows + RepoScanRun rows
 * 3. AI pre-population → system_inferred Answers with citations
 */

import { prisma } from "./prisma";
import {
  invokeBindJson,
  invokeBindJsonWithUsage,
  invokeBindWithUsage,
} from "./openrouter";
import { downloadFile } from "./storage";
import { clampText, extractText } from "./extractors";
import { scanGitHubRepo } from "./repo-scanner";
import { getActiveQuestions } from "./activation-engine";
import type { RepoScanKind } from "../generated/prisma/client";

const MAX_DOC_CHARS = 60_000;

// ─── Document Extraction ─────────────────────────────────────────────────────

interface ExtractionResult {
  summary: string;
  facts: Record<string, unknown>[];
}

export async function extractDocument(documentId: string): Promise<void> {
  const doc = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
    include: { project: true },
  });

  let content: string;
  try {
    const bytes = await downloadFile(doc.uri);
    const text = await extractText(bytes, doc.mimeType);
    content = clampText(text, MAX_DOC_CHARS);
  } catch (err) {
    await prisma.docExtraction.create({
      data: {
        documentId,
        projectId: doc.projectId,
        summary: `Failed to read document: ${(err as Error).message}`,
        extractedFacts: [],
      },
    });
    return;
  }

  try {
    const result = await invokeBindJson<ExtractionResult>("doc-extraction", {
      filename: doc.filename,
      mimeType: doc.mimeType,
      projectName: doc.project.name,
      content,
    });

    await prisma.docExtraction.create({
      data: {
        documentId,
        projectId: doc.projectId,
        summary: result.summary,
        extractedFacts: result.facts as any,
      },
    });
  } catch (err) {
    await prisma.docExtraction.create({
      data: {
        documentId,
        projectId: doc.projectId,
        summary: `LLM extraction failed: ${(err as Error).message}`,
        extractedFacts: [],
      },
    });
  }
}

// ─── Repo Scanning ───────────────────────────────────────────────────────────

export async function scanRepo(projectId: string, repoUrl: string): Promise<void> {
  // Drop stale findings for this repo so a re-scan reflects current state.
  await prisma.repoFinding.deleteMany({ where: { projectId, repoUrl } });

  let result;
  try {
    result = await scanGitHubRepo(repoUrl);
  } catch (err) {
    await prisma.repoFinding.create({
      data: {
        projectId,
        repoUrl,
        commitSha: "scan_failed",
        findingType: "scan_error",
        evidence: `Scan failed: ${(err as Error).message}`,
      },
    });
    await prisma.project.update({
      where: { id: projectId },
      data: { repoLastScanAt: new Date(), repoLastScanSha: null },
    });
    return;
  }

  for (const f of result.findings) {
    await prisma.repoFinding.create({
      data: {
        projectId,
        repoUrl,
        commitSha: result.commitSha,
        findingType: f.findingType,
        evidence: f.evidence,
        filePath: f.filePath || null,
      },
    });
  }

  await prisma.project.update({
    where: { id: projectId },
    data: {
      repoLastScanAt: new Date(),
      repoLastScanSha: result.commitSha,
    },
  });
}

// ─── AI Pre-population ───────────────────────────────────────────────────────

interface PrePopulationResult {
  value: unknown;
  confidence: number;
  citation: string;
}

export interface PrePopulationStats {
  answersWritten: number;
  questionsConsidered: number;
  lowConfidenceSkipped: number;
  processed: number;
  total: number;
  tokensUsed: number;
  cancelled: boolean;
  /** Last ~120 chars of the LLM response currently being streamed in. Cleared between iterations. */
  streamTail?: string;
  /** Live token estimate for the in-flight call only. Cleared between iterations. */
  streamTokensApprox?: number;
}

const STREAM_TAIL_CHARS = 120;
const STREAM_WRITE_DEBOUNCE_MS = 500;

const PREPOP_CONFIDENCE_THRESHOLD = 0.5;
// Per-question LLM call timeout. Pre-pop sums many calls, so a single slow
// model response shouldn't be allowed to stall the whole loop indefinitely.
const PREPOP_LLM_TIMEOUT_MS = 60_000;
// How often (in completed iterations) to flush partial progress to the
// RepoScanRun.output JSON. With ~50 questions in a typical run, every 5 keeps
// the UI feeling alive without hammering the DB.
const PROGRESS_WRITE_EVERY_N = 5;

export async function prePopulateAnswers(
  projectId: string,
  opts: { runId?: string } = {}
): Promise<PrePopulationStats> {
  // Apply DAG activation rules. Without this filter, prepop would attempt every
  // non-"none" question regardless of whether dependency rules say it's even
  // visible for this project — wasting tokens on questions the owner can't see.
  const { activeQuestionVersionIds } = await getActiveQuestions(projectId);
  const activeIdSet = new Set(activeQuestionVersionIds);

  const candidates = await prisma.questionVersion.findMany({
    where: {
      aiPrepopulationPriority: { not: "none" },
      answers: { none: { projectId } },
      id: { in: Array.from(activeIdSet) },
    },
    include: { question: { include: { section: true } } },
    orderBy: [{ aiPrepopulationPriority: "asc" }],
  });

  const evidenceContext = await buildEvidenceContext(projectId);

  const baseStats: PrePopulationStats = {
    answersWritten: 0,
    questionsConsidered: candidates.length,
    lowConfidenceSkipped: 0,
    processed: 0,
    total: candidates.length,
    tokensUsed: 0,
    cancelled: false,
  };

  console.log(
    `[prepop] project=${projectId} candidates=${candidates.length} ` +
      `evidence_len=${evidenceContext.length}`
  );

  if (!evidenceContext.trim() || candidates.length === 0) {
    if (opts.runId) await writeProgress(opts.runId, baseStats);
    return baseStats;
  }

  const stats: PrePopulationStats = { ...baseStats };

  // Abort plumbing: a 2-second background poller watches the run row's
  // cancelRequested flag. When it flips, we abort the controller, which
  // bubbles into any in-flight `fetch` to OpenRouter and breaks the loop on
  // the next iteration. Without this, Stop has to wait for the current LLM
  // call to finish (up to PREPOP_LLM_TIMEOUT_MS).
  const cancelController = new AbortController();
  let cancelPoller: ReturnType<typeof setInterval> | null = null;
  if (opts.runId) {
    const runId = opts.runId;
    cancelPoller = setInterval(async () => {
      try {
        if (await isCancelRequested(runId)) {
          cancelController.abort();
          if (cancelPoller) clearInterval(cancelPoller);
          cancelPoller = null;
        }
      } catch {
        // Transient DB error — try again next tick.
      }
    }, 2000);
  }

  try {
    for (const version of candidates) {
      if (cancelController.signal.aborted) {
        stats.cancelled = true;
        console.log(`[prepop] cancel requested at processed=${stats.processed}`);
        break;
      }

      // Throttle DB writes for the live stream so we don't pound the database.
      // The poller on the UI side reads every ~1s; 500ms here is plenty.
      let lastStreamWrite = 0;
      try {
        const { value: result, usage } = await invokeBindJsonWithUsage<PrePopulationResult>(
          "answer-prepopulation",
          {
            questionPrompt: version.prompt,
            answerType: version.answerType,
            options: version.options ? JSON.stringify(version.options) : "",
            evidence: evidenceContext,
          },
          {
            timeoutMs: PREPOP_LLM_TIMEOUT_MS,
            signal: cancelController.signal,
            onChunk: opts.runId
              ? ({ contentSoFar, approxTokens }) => {
                  const now = Date.now();
                  if (now - lastStreamWrite < STREAM_WRITE_DEBOUNCE_MS) return;
                  lastStreamWrite = now;
                  stats.streamTail = contentSoFar.slice(-STREAM_TAIL_CHARS);
                  stats.streamTokensApprox = approxTokens;
                  // Fire and forget — if the write loses to the next chunk's
                  // write we don't care, only the latest matters.
                  void writeProgress(opts.runId!, stats);
                }
              : undefined,
          }
        );
        stats.tokensUsed += usage.totalTokens;
        // Clear stream telemetry now that this call is done.
        stats.streamTail = undefined;
        stats.streamTokensApprox = undefined;

        if (result.value !== null && result.confidence >= PREPOP_CONFIDENCE_THRESHOLD) {
          await prisma.answer.create({
            data: {
              projectId,
              questionVersionId: version.id,
              value: result.value as any,
              source: "system_inferred",
              aiConfidence: result.confidence,
              citation: result.citation,
            },
          });
          stats.answersWritten++;
        } else {
          stats.lowConfidenceSkipped++;
        }
      } catch (err) {
        // Clear any partial stream telemetry from the failed call.
        stats.streamTail = undefined;
        stats.streamTokensApprox = undefined;
        // If the abort was caller-initiated, it's a cancel: break the loop.
        // Other errors (timeout, bad JSON, etc.) are logged and skipped.
        if (cancelController.signal.aborted) {
          stats.cancelled = true;
          console.log(`[prepop] aborted mid-call at processed=${stats.processed}`);
          break;
        }
        stats.lowConfidenceSkipped++;
        console.warn(
          `[prepop] question ${version.question.slug} failed: ${(err as Error).message}`
        );
      }

      stats.processed++;
      if (opts.runId && stats.processed % PROGRESS_WRITE_EVERY_N === 0) {
        await writeProgress(opts.runId, stats);
      }
    }
  } finally {
    if (cancelPoller) clearInterval(cancelPoller);
  }

  if (opts.runId) await writeProgress(opts.runId, stats);
  console.log(
    `[prepop] project=${projectId} done answersWritten=${stats.answersWritten} ` +
      `processed=${stats.processed}/${stats.total} tokens=${stats.tokensUsed} ` +
      `cancelled=${stats.cancelled}`
  );
  return stats;
}

async function isCancelRequested(runId: string): Promise<boolean> {
  const row = await prisma.repoScanRun.findUnique({
    where: { id: runId },
    select: { cancelRequested: true },
  });
  return row?.cancelRequested ?? false;
}

async function writeProgress(
  runId: string,
  stats: PrePopulationStats
): Promise<void> {
  await prisma.repoScanRun.update({
    where: { id: runId },
    data: { output: stats as any },
  });
}

// ─── Phase 3 — three named scan kinds with discrete RepoScanRun rows ─────────

/**
 * Concatenates DocExtraction summaries + RepoFinding evidence for a project
 * into the single text blob the LLM consumes.
 */
async function buildEvidenceContext(projectId: string): Promise<string> {
  const [extractions, repoFindings] = await Promise.all([
    prisma.docExtraction.findMany({ where: { projectId } }),
    prisma.repoFinding.findMany({ where: { projectId } }),
  ]);
  return [
    ...extractions.map(
      (e) => `[Document] ${e.summary}\nFacts: ${JSON.stringify(e.extractedFacts)}`
    ),
    ...repoFindings.map(
      (r) =>
        `[Repo finding] ${r.findingType}: ${r.evidence}` +
        (r.filePath ? ` @ ${r.filePath}` : "")
    ),
  ].join("\n\n");
}

interface RunScanContext {
  projectId: string;
  triggeredBy?: string | null;
}

/**
 * Open a RepoScanRun in `running` state, run the body, and finalize the row
 * with `succeeded`/`failed`. The body receives the run id (so loops can poll
 * cancelRequested and write progress) and may return an explicit
 * `{ status: 'failed', errorMessage }` to mark the row failed without
 * throwing — used when a cancel was requested mid-loop.
 */
async function withScanRun<T>(
  kind: RepoScanKind,
  ctx: RunScanContext,
  body: (runId: string) => Promise<{
    output: T;
    commitSha?: string | null;
    status?: "succeeded" | "failed";
    errorMessage?: string | null;
  }>
) {
  console.log(`[scan:${kind}] starting project=${ctx.projectId}`);
  // Orphan cleanup: any prior `running` row for this project+kind is by
  // definition stale once we start a new one. Process death, dev-server
  // restart, browser close — all of those leave running rows that no longer
  // have a process listening to their cancelRequested flag. Fail them now so
  // the UI doesn't show ghost "RUNNING" pills next to the live row.
  await prisma.repoScanRun.updateMany({
    where: { projectId: ctx.projectId, kind, status: "running" },
    data: {
      status: "failed",
      errorMessage: "Superseded by a new run",
      finishedAt: new Date(),
    },
  });

  const run = await prisma.repoScanRun.create({
    data: {
      projectId: ctx.projectId,
      kind,
      status: "running",
      triggeredBy: ctx.triggeredBy ?? null,
    },
  });

  try {
    const { output, commitSha, status, errorMessage } = await body(run.id);
    const finalStatus = status ?? "succeeded";
    console.log(
      `[scan:${kind}] ${finalStatus} run=${run.id}` +
        (errorMessage ? ` reason=${errorMessage}` : "")
    );
    return prisma.repoScanRun.update({
      where: { id: run.id },
      data: {
        status: finalStatus,
        output: output as any,
        commitSha: commitSha ?? null,
        errorMessage: errorMessage ?? null,
        finishedAt: new Date(),
      },
    });
  } catch (err) {
    const message = (err as Error).message;
    console.warn(`[scan:${kind}] failed run=${run.id} error=${message}`);
    return prisma.repoScanRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        errorMessage: message,
        finishedAt: new Date(),
      },
    });
  }
}

/**
 * Walks the repo to refresh RepoFinding rows. Idempotent — drops stale findings
 * for the URL and re-emits. Used as the prerequisite to all three named scans;
 * each scan kind reads RepoFindings + DocExtractions as evidence.
 */
async function refreshRepoFindings(projectId: string): Promise<{ commitSha: string | null }> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { repoUrl: true },
  });
  if (!project.repoUrl) return { commitSha: null };
  await scanRepo(projectId, project.repoUrl);
  const fresh = await prisma.project.findUnique({
    where: { id: projectId },
    select: { repoLastScanSha: true },
  });
  return { commitSha: fresh?.repoLastScanSha ?? null };
}

// Per-scan timeout for the heavy structured/prose calls. These can legitimately
// take a couple of minutes on large repos; the per-prepop-question timeout is
// shorter (60s) since each one is a small ask.
const HEAVY_SCAN_TIMEOUT_MS = 240_000;
// The technical-description JSON output is large (project_summary,
// codebase_inventory, repo_findings, answers, pattern_matches, discrepancies,
// owner_attestation_required, persona_summaries, review_metadata). The bound
// model's default 4096 cap truncates output mid-string, producing JSON parse
// failures. Bumping to 16K covers the typical full output.
const HEAVY_SCAN_MAX_TOKENS = 16_384;

/**
 * Build a debounced onChunk handler that writes streaming telemetry to a
 * RepoScanRun row. Used by the heavy (single-LLM-call) scans so the UI can
 * show live tokens + ticker text while one big call is in flight.
 */
function makeStreamWriter(runId: string) {
  let lastWrite = 0;
  return ({ contentSoFar, approxTokens }: {
    contentSoFar: string;
    charCount: number;
    approxTokens: number;
  }) => {
    const now = Date.now();
    if (now - lastWrite < STREAM_WRITE_DEBOUNCE_MS) return;
    lastWrite = now;
    void prisma.repoScanRun.update({
      where: { id: runId },
      data: {
        output: {
          streamTail: contentSoFar.slice(-STREAM_TAIL_CHARS),
          streamTokensApprox: approxTokens,
        } as any,
      },
    });
  };
}

/**
 * Kind 1 — evidence-cited human-readable technical analysis.
 *
 * Produces Markdown prose grouped by the eight ARC risk categories. The prompt
 * lives at prisma/prompts/repo-scan-technical.md. Output is markdown, not JSON
 * (per the new prompt design — slugs and per-question pre-population are
 * handled separately by `runQuestionPrepopulationScan`).
 */
export async function runTechnicalDescriptionScan(ctx: RunScanContext) {
  return withScanRun("technical_description", ctx, async (runId) => {
    const { commitSha } = await refreshRepoFindings(ctx.projectId);
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: ctx.projectId },
      select: { name: true, scopeType: true, repoUrl: true },
    });
    if (!project.repoUrl) {
      throw new Error("No repo URL set on this project");
    }

    const evidence = await buildEvidenceContext(ctx.projectId);
    const { content: markdown, usage } = await invokeBindWithUsage(
      "repo-scan-technical",
      {
        repoUrl: project.repoUrl,
        projectName: project.name,
        scopeType: project.scopeType,
        evidence: evidence || "(no evidence available)",
      },
      {
        timeoutMs: HEAVY_SCAN_TIMEOUT_MS,
        maxTokens: HEAVY_SCAN_MAX_TOKENS,
        onChunk: makeStreamWriter(runId),
      }
    );

    return {
      output: {
        markdown,
        generatedAt: new Date().toISOString(),
        commitSha: commitSha ?? null,
        tokensUsed: usage.totalTokens,
      },
      commitSha,
    };
  });
}

/** Kind 2 — plain-English reviewer-facing risk review (markdown prose). */
export async function runReviewerRiskScan(ctx: RunScanContext) {
  return withScanRun("reviewer_risk_review", ctx, async (runId) => {
    const { commitSha } = await refreshRepoFindings(ctx.projectId);
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: ctx.projectId },
      select: { name: true, scopeType: true, repoUrl: true },
    });
    if (!project.repoUrl) {
      throw new Error("No repo URL set on this project");
    }

    const evidence = await buildEvidenceContext(ctx.projectId);
    const { content: markdown, usage } = await invokeBindWithUsage(
      "repo-scan-risk-review",
      {
        repoUrl: project.repoUrl,
        projectName: project.name,
        scopeType: project.scopeType,
        evidence: evidence || "(no evidence available)",
      },
      {
        timeoutMs: HEAVY_SCAN_TIMEOUT_MS,
        maxTokens: HEAVY_SCAN_MAX_TOKENS,
        onChunk: makeStreamWriter(runId),
      }
    );

    return {
      output: {
        markdown,
        generatedAt: new Date().toISOString(),
        commitSha: commitSha ?? null,
        tokensUsed: usage.totalTokens,
      },
      commitSha,
    };
  });
}

/** Kind 3 — pre-populate corpus answers from repo + document evidence. */
export async function runQuestionPrepopulationScan(ctx: RunScanContext) {
  return withScanRun("question_prepopulation", ctx, async (runId) => {
    const { commitSha } = await refreshRepoFindings(ctx.projectId);
    const stats = await prePopulateAnswers(ctx.projectId, { runId });
    if (stats.cancelled) {
      return {
        output: stats,
        commitSha,
        status: "failed",
        errorMessage: "Cancelled by owner",
      };
    }
    return { output: stats, commitSha };
  });
}

/**
 * Run all three scans sequentially. Failure of any one is captured on its own
 * RepoScanRun row and does not block the others.
 */
export async function runAllRepoScans(ctx: RunScanContext) {
  const technical = await runTechnicalDescriptionScan(ctx);
  const risk = await runReviewerRiskScan(ctx);
  const prepop = await runQuestionPrepopulationScan(ctx);
  return [technical, risk, prepop];
}
