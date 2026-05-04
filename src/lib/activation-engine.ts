/**
 * Activation Engine — evaluates the dependency DAG to determine which questions
 * are active for a given project based on current answers.
 *
 * Core rule: a question is active if ALL its activation conditions are satisfied.
 * Questions with no dependencies (activates_when: []) are always active (foundational).
 */

import { prisma } from "./prisma";

interface ActivationRule {
  condition: string;
  value?: unknown;
  values?: unknown[];
  conditions?: ActivationRule[];
}

/**
 * Evaluate a single activation condition against an answer value.
 */
function evaluateCondition(rule: ActivationRule, answerValue: unknown): boolean {
  switch (rule.condition) {
    case "equals":
      if (Array.isArray(answerValue) && Array.isArray(rule.value)) {
        return JSON.stringify(answerValue.sort()) === JSON.stringify([...rule.value].sort());
      }
      return answerValue === rule.value;

    case "not_equals":
      return answerValue !== rule.value;

    case "in":
      return Array.isArray(rule.values) && rule.values.includes(answerValue as string);

    case "not_in":
      return Array.isArray(rule.values) && !rule.values.includes(answerValue as string);

    case "contains":
      return Array.isArray(answerValue) && answerValue.includes(rule.value);

    case "not_contains":
      return Array.isArray(answerValue) && !answerValue.includes(rule.value);

    case "any_of":
      return Array.isArray(rule.conditions) &&
        rule.conditions.some((c) => evaluateCondition(c, answerValue));

    case "all_of":
      return Array.isArray(rule.conditions) &&
        rule.conditions.every((c) => evaluateCondition(c, answerValue));

    default:
      return false;
  }
}

/**
 * Get the set of active question version IDs for a project.
 * Returns { activeQuestionVersionIds, allQuestionVersionIds }
 */
export async function getActiveQuestions(projectId: string) {
  // Get all question versions (latest version per question)
  const allVersions = await prisma.questionVersion.findMany({
    include: {
      question: true,
      parentDependencies: {
        include: {
          parentVersion: {
            include: { question: true },
          },
        },
      },
    },
    orderBy: { version: "desc" },
    distinct: ["questionId"],
  });

  // Get all answers for this project
  const answers = await prisma.answer.findMany({
    where: { projectId },
    include: { questionVersion: { include: { question: true } } },
  });

  // Build a lookup: question slug → answer value
  const answerBySlug = new Map<string, unknown>();
  for (const answer of answers) {
    answerBySlug.set(answer.questionVersion.question.slug, answer.value);
  }

  const activeIds: string[] = [];
  const allIds: string[] = [];

  for (const version of allVersions) {
    allIds.push(version.id);

    // No dependencies = foundational = always active
    if (version.parentDependencies.length === 0) {
      activeIds.push(version.id);
      continue;
    }

    // All dependencies must be satisfied (AND semantics)
    const allSatisfied = version.parentDependencies.every((dep) => {
      const parentSlug = dep.parentVersion.question.slug;
      const parentAnswer = answerBySlug.get(parentSlug);

      // If parent hasn't been answered yet, condition is not satisfied
      if (parentAnswer === undefined) return false;

      return evaluateCondition(dep.activationRule as unknown as ActivationRule, parentAnswer);
    });

    if (allSatisfied) {
      activeIds.push(version.id);
    }
  }

  return { activeQuestionVersionIds: activeIds, allQuestionVersionIds: allIds };
}

/**
 * Get active questions grouped by section for a project.
 */
export async function getActiveQuestionsBySection(projectId: string) {
  const { activeQuestionVersionIds } = await getActiveQuestions(projectId);

  const activeVersions = await prisma.questionVersion.findMany({
    where: { id: { in: activeQuestionVersionIds } },
    include: {
      question: {
        include: { section: true },
      },
      parentDependencies: true,
    },
    orderBy: [
      { question: { section: { displayOrder: "asc" } } },
      { question: { slug: "asc" } },
    ],
  });

  // Group by section
  const bySection = new Map<string, typeof activeVersions>();
  for (const v of activeVersions) {
    const sectionSlug = v.question.section.slug;
    if (!bySection.has(sectionSlug)) bySection.set(sectionSlug, []);
    bySection.get(sectionSlug)!.push(v);
  }

  return bySection;
}
