/**
 * Ingestion Pipeline — processes documents and repos to pre-populate answers.
 *
 * Three stages:
 * 1. Document extraction → DocExtraction rows
 * 2. Repo scanning → RepoFinding rows
 * 3. AI pre-population → system_inferred Answers with citations
 */

import { prisma } from "./prisma";
import { chat, extractJson } from "./openrouter";

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

  // In production, we'd fetch the document content from `doc.uri`.
  // For now, we create a placeholder extraction that can be filled by the LLM.
  const prompt = `Extract structured facts from this document that would be relevant to a risk attestation questionnaire.

Document: ${doc.filename} (${doc.mimeType})
Project: ${doc.project.name}

Return a JSON object with:
- "summary": a 2-3 sentence summary of the document's relevance to risk assessment
- "facts": an array of objects, each with "category" (data_classification, ai_usage, hosting, audience, etc.), "claim" (the factual statement), and "confidence" (0-1)`;

  try {
    const result = await extractJson<ExtractionResult>(prompt, `[Document content would be provided here from URI: ${doc.uri}]`, "medium");

    await prisma.docExtraction.create({
      data: {
        documentId,
        projectId: doc.projectId,
        summary: result.summary,
        extractedFacts: result.facts as any,
      },
    });
  } catch {
    // Create a stub extraction if LLM fails (API key not configured, etc.)
    await prisma.docExtraction.create({
      data: {
        documentId,
        projectId: doc.projectId,
        summary: `Pending extraction for: ${doc.filename}`,
        extractedFacts: [],
      },
    });
  }
}

// ─── Repo Scanning ───────────────────────────────────────────────────────────

export async function scanRepo(projectId: string, repoUrl: string): Promise<void> {
  // In production, this would clone the repo and analyze it.
  // Key findings: AI dependencies, OSS licenses, data handling patterns, security config.
  const prompt = `Analyze this repository URL for risk assessment findings.

Repository: ${repoUrl}

Identify:
1. AI/ML dependencies (tensorflow, pytorch, langchain, openai, etc.)
2. Open source licenses that may be copyleft
3. Data handling patterns (encryption, storage, PII markers)
4. Security configuration (auth, secrets management)
5. Infrastructure/hosting indicators

Return JSON array of findings, each with: "finding_type", "evidence", "file_path" (if applicable), "line_number" (if applicable)`;

  try {
    const findings = await extractJson<
      { finding_type: string; evidence: string; file_path?: string; line_number?: number }[]
    >(prompt, `[Repository analysis would be performed here for: ${repoUrl}]`, "medium");

    for (const f of findings) {
      await prisma.repoFinding.create({
        data: {
          projectId,
          repoUrl,
          commitSha: "HEAD", // In production, resolve to actual SHA
          findingType: f.finding_type,
          evidence: f.evidence,
          filePath: f.file_path || null,
          lineNumber: f.line_number || null,
        },
      });
    }
  } catch {
    // Stub finding if LLM unavailable
    await prisma.repoFinding.create({
      data: {
        projectId,
        repoUrl,
        commitSha: "pending",
        findingType: "scan_pending",
        evidence: `Repository scan pending for: ${repoUrl}`,
      },
    });
  }
}

// ─── AI Pre-population ───────────────────────────────────────────────────────

interface PrePopulationResult {
  value: unknown;
  confidence: number;
  citation: string;
}

export async function prePopulateAnswers(projectId: string): Promise<number> {
  // Get all active questions that haven't been answered yet
  const activeVersions = await prisma.questionVersion.findMany({
    where: {
      aiPrepopulationPriority: { not: "none" },
      answers: { none: { projectId } },
    },
    include: {
      question: { include: { section: true } },
    },
    orderBy: [
      { aiPrepopulationPriority: "asc" }, // high first (enum ordering)
    ],
  });

  // Get existing evidence
  const extractions = await prisma.docExtraction.findMany({
    where: { projectId },
  });
  const repoFindings = await prisma.repoFinding.findMany({
    where: { projectId },
  });

  const evidenceContext = [
    ...extractions.map((e) => `[Document] ${e.summary}\nFacts: ${JSON.stringify(e.extractedFacts)}`),
    ...repoFindings.map((r) => `[Repo] ${r.findingType}: ${r.evidence}`),
  ].join("\n\n");

  if (!evidenceContext.trim()) return 0;

  let populated = 0;

  for (const version of activeVersions) {
    const prompt = `Based on the evidence below, answer this risk assessment question.

Question: ${version.prompt}
Answer type: ${version.answerType}
${version.options ? `Options: ${JSON.stringify(version.options)}` : ""}

Return JSON with:
- "value": the answer value (must match the answer_type format)
- "confidence": 0-1 confidence score
- "citation": brief citation of which evidence supports this answer

If you cannot determine an answer from the evidence, return {"value": null, "confidence": 0, "citation": "Insufficient evidence"}`;

    try {
      const result = await extractJson<PrePopulationResult>(
        prompt,
        evidenceContext,
        version.aiPrepopulationPriority === "high" ? "heavy" : "light"
      );

      if (result.value !== null && result.confidence >= 0.5) {
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
        populated++;
      }
    } catch {
      // Skip questions where LLM fails
      continue;
    }
  }

  return populated;
}
