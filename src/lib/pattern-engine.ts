/**
 * Pattern Matching Engine — evaluates project answers against Pattern criteria
 * to determine fast-track eligibility.
 *
 * Patterns define criteria as a list of conditions on question slugs.
 * A PatternMatch stores the fit score (0-1) and missing criteria.
 */

import { prisma } from "./prisma";

interface PatternCriterion {
  slug: string;
  condition: string;
  value?: unknown;
  values?: unknown[];
}

interface PatternMatchResult {
  patternVersionId: string;
  patternName: string;
  fitScore: number;
  missingCriteria: PatternCriterion[];
  reviewerWaivers: unknown;
}

function evaluateCriterion(
  criterion: PatternCriterion,
  answerValue: unknown
): boolean {
  if (answerValue === undefined || answerValue === null) return false;

  switch (criterion.condition) {
    case "equals":
      if (Array.isArray(answerValue) && Array.isArray(criterion.value)) {
        return JSON.stringify(answerValue.sort()) === JSON.stringify([...criterion.value].sort());
      }
      return answerValue === criterion.value;

    case "not_equals":
      return answerValue !== criterion.value;

    case "in":
      return Array.isArray(criterion.values) && criterion.values.includes(answerValue as string);

    case "not_in":
      return Array.isArray(criterion.values) && !criterion.values.includes(answerValue as string);

    case "contains":
      return Array.isArray(answerValue) && answerValue.includes(criterion.value);

    case "not_contains":
      return Array.isArray(answerValue) && !answerValue.includes(criterion.value);

    default:
      return false;
  }
}

/**
 * Evaluate all patterns against a project's current answers.
 * Creates/updates PatternMatch rows.
 */
export async function evaluatePatterns(projectId: string): Promise<PatternMatchResult[]> {
  // Get all answers for the project, keyed by question slug
  const answers = await prisma.answer.findMany({
    where: { projectId },
    include: { questionVersion: { include: { question: true } } },
  });

  const answerBySlug = new Map<string, unknown>();
  for (const a of answers) {
    answerBySlug.set(a.questionVersion.question.slug, a.value);
  }

  // Get all latest pattern versions
  const patternVersions = await prisma.patternVersion.findMany({
    orderBy: { version: "desc" },
    distinct: ["patternId"],
    include: { pattern: true },
  });

  const results: PatternMatchResult[] = [];

  for (const pv of patternVersions) {
    const criteria = pv.criteria as unknown as PatternCriterion[];
    if (!Array.isArray(criteria) || criteria.length === 0) continue;

    const missing: PatternCriterion[] = [];
    let matched = 0;

    for (const criterion of criteria) {
      const answerValue = answerBySlug.get(criterion.slug);

      if (evaluateCriterion(criterion, answerValue)) {
        matched++;
      } else {
        missing.push(criterion);
      }
    }

    const fitScore = criteria.length > 0 ? matched / criteria.length : 0;

    // Upsert PatternMatch
    await prisma.patternMatch.upsert({
      where: {
        projectId_patternVersionId: {
          projectId,
          patternVersionId: pv.id,
        },
      },
      update: {
        fitScore,
        missingCriteria: missing as any,
        lastEvaluated: new Date(),
      },
      create: {
        projectId,
        patternVersionId: pv.id,
        fitScore,
        missingCriteria: missing as any,
      },
    });

    results.push({
      patternVersionId: pv.id,
      patternName: pv.pattern.name,
      fitScore,
      missingCriteria: missing,
      reviewerWaivers: pv.reviewerWaivers,
    });
  }

  return results;
}

/**
 * Determine if a project qualifies for fast-track based on pattern matches.
 */
export async function getFastTrackStatus(projectId: string) {
  const matches = await prisma.patternMatch.findMany({
    where: { projectId },
    include: { patternVersion: { include: { pattern: true } } },
    orderBy: { fitScore: "desc" },
  });

  const fullMatches = matches.filter((m) => m.fitScore >= 1.0);
  const nearMatches = matches.filter((m) => m.fitScore >= 0.8 && m.fitScore < 1.0);

  return {
    eligible: fullMatches.length > 0,
    fullMatches: fullMatches.map((m) => ({
      pattern: m.patternVersion.pattern.name,
      waivers: m.patternVersion.reviewerWaivers,
    })),
    nearMatches: nearMatches.map((m) => ({
      pattern: m.patternVersion.pattern.name,
      fitScore: m.fitScore,
      missing: m.missingCriteria,
    })),
    allMatches: matches.map((m) => ({
      pattern: m.patternVersion.pattern.name,
      fitScore: m.fitScore,
    })),
  };
}
