/**
 * Corpus Loader — reads YAML question files and seeds the database.
 *
 * Usage: npx tsx scripts/seed-corpus.ts
 *
 * What it does:
 * 1. Reads _sections.yaml → creates Section rows
 * 2. Reads _patterns.yaml → creates Pattern + PatternVersion rows
 * 3. Reads each section YAML file → creates Question + QuestionVersion rows
 * 4. Resolves activates_when → creates QuestionDependency rows
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { parse } from "yaml";
import "dotenv/config";

function getPostgresUrl(): string {
  const url = process.env.DATABASE_URL || "";
  if (url.startsWith("prisma+postgres")) {
    const apiKey = new URL(url.replace("prisma+postgres", "http")).searchParams.get("api_key");
    if (apiKey) {
      const decoded = JSON.parse(Buffer.from(apiKey, "base64").toString());
      return decoded.databaseUrl;
    }
  }
  return url;
}

const adapter = new PrismaPg({ connectionString: getPostgresUrl() });
const prisma = new (PrismaClient as any)({ adapter }) as InstanceType<typeof PrismaClient>;
const QUESTIONS_DIR = join(__dirname, "..", "docs", "questions");

// ─── Types for YAML structures ───────────────────────────────────────────────

interface SectionEntry {
  slug: string;
  display_name: string;
  display_order: number;
  description: string;
  review_domain?: string;
}

interface PatternEntry {
  name: string;
  description: string;
  criteria: unknown[];
  jurisdiction_scope: unknown;
  reviewer_waivers: unknown[];
}

interface ActivationCondition {
  parent_slug: string;
  condition: string;
  value?: unknown;
  values?: unknown[];
  conditions?: ActivationCondition[];
}

interface QuestionEntry {
  slug: string;
  prompt: string;
  answer_type: string;
  options?: { value: string; label: string; help_text?: string }[];
  required: boolean;
  ai_prepopulation_priority?: string;
  help_text?: string;
  examples?: string[];
  routes_to_review_domains?: string[];
  validation?: Record<string, unknown>;
  activates_when: ActivationCondition[];
}

interface QuestionFile {
  section: string;
  description: string;
  questions: QuestionEntry[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readYaml<T>(filename: string): T {
  const content = readFileSync(join(QUESTIONS_DIR, filename), "utf-8");
  return parse(content) as T;
}

// ─── Seed Sections ───────────────────────────────────────────────────────────

async function seedSections(): Promise<Map<string, string>> {
  const data = readYaml<{ sections: SectionEntry[] }>("_sections.yaml");
  const slugToId = new Map<string, string>();

  for (const section of data.sections) {
    const row = await prisma.section.upsert({
      where: { slug: section.slug },
      update: {
        displayName: section.display_name,
        displayOrder: section.display_order,
      },
      create: {
        slug: section.slug,
        displayName: section.display_name,
        displayOrder: section.display_order,
      },
    });
    slugToId.set(section.slug, row.id);
  }

  console.log(`✓ Seeded ${slugToId.size} sections`);
  return slugToId;
}

// ─── Seed Patterns ───────────────────────────────────────────────────────────

async function seedPatterns(): Promise<void> {
  const data = readYaml<{ patterns: PatternEntry[] }>("_patterns.yaml");

  for (const pattern of data.patterns) {
    const row = await prisma.pattern.upsert({
      where: { name: pattern.name },
      update: { description: pattern.description },
      create: { name: pattern.name, description: pattern.description },
    });

    // Upsert version 1
    await prisma.patternVersion.upsert({
      where: { patternId_version: { patternId: row.id, version: 1 } },
      update: {
        criteria: pattern.criteria as unknown as object,
        jurisdictionScope: pattern.jurisdiction_scope as unknown as object,
        reviewerWaivers: pattern.reviewer_waivers as unknown as object,
      },
      create: {
        patternId: row.id,
        version: 1,
        criteria: pattern.criteria as unknown as object,
        jurisdictionScope: pattern.jurisdiction_scope as unknown as object,
        reviewerWaivers: pattern.reviewer_waivers as unknown as object,
      },
    });
  }

  console.log(`✓ Seeded ${data.patterns.length} patterns`);
}

// ─── Seed Questions ──────────────────────────────────────────────────────────

async function seedQuestions(
  sectionMap: Map<string, string>
): Promise<Map<string, string>> {
  const slugToVersionId = new Map<string, string>();

  // Find all section YAML files (excluding meta files starting with _)
  const files = readdirSync(QUESTIONS_DIR).filter(
    (f) => f.endsWith(".yaml") && !f.startsWith("_")
  );

  for (const file of files) {
    const data = readYaml<QuestionFile>(file);
    const sectionId = sectionMap.get(data.section);

    if (!sectionId) {
      console.warn(`⚠ Section "${data.section}" not found for file ${file}, skipping`);
      continue;
    }

    for (const q of data.questions) {
      // Upsert Question (stable identity)
      const question = await prisma.question.upsert({
        where: { slug: q.slug },
        update: { sectionId },
        create: { slug: q.slug, sectionId },
      });

      // Upsert QuestionVersion (version 1)
      const version = await prisma.questionVersion.upsert({
        where: {
          questionId_version: { questionId: question.id, version: 1 },
        },
        update: {
          prompt: q.prompt,
          answerType: q.answer_type as any,
          options: q.options as any,
          helpText: q.help_text || null,
          examples: q.examples || null,
          required: q.required,
          aiPrepopulationPriority: (q.ai_prepopulation_priority || "medium") as any,
          routesToReviewDomains: q.routes_to_review_domains || null,
        },
        create: {
          questionId: question.id,
          version: 1,
          prompt: q.prompt,
          answerType: q.answer_type as any,
          options: q.options as any,
          helpText: q.help_text || null,
          examples: q.examples || null,
          required: q.required,
          aiPrepopulationPriority: (q.ai_prepopulation_priority || "medium") as any,
          routesToReviewDomains: q.routes_to_review_domains || null,
        },
      });

      slugToVersionId.set(q.slug, version.id);
    }

    console.log(`  ✓ ${file}: ${data.questions.length} questions`);
  }

  console.log(`✓ Seeded ${slugToVersionId.size} total questions`);
  return slugToVersionId;
}

// ─── Seed Dependencies ───────────────────────────────────────────────────────

async function seedDependencies(
  slugToVersionId: Map<string, string>
): Promise<void> {
  const files = readdirSync(QUESTIONS_DIR).filter(
    (f) => f.endsWith(".yaml") && !f.startsWith("_")
  );

  let depCount = 0;

  for (const file of files) {
    const data = readYaml<QuestionFile>(file);

    for (const q of data.questions) {
      if (!q.activates_when || q.activates_when.length === 0) continue;

      const childVersionId = slugToVersionId.get(q.slug);
      if (!childVersionId) continue;

      for (const dep of q.activates_when) {
        const parentVersionId = slugToVersionId.get(dep.parent_slug);
        if (!parentVersionId) {
          console.warn(
            `⚠ Parent slug "${dep.parent_slug}" not found for dependency on "${q.slug}"`
          );
          continue;
        }

        await prisma.questionDependency.upsert({
          where: {
            parentVersionId_childVersionId: {
              parentVersionId,
              childVersionId,
            },
          },
          update: {
            activationRule: {
              condition: dep.condition,
              value: dep.value,
              values: dep.values,
            } as any,
          },
          create: {
            parentVersionId,
            childVersionId,
            activationRule: {
              condition: dep.condition,
              value: dep.value,
              values: dep.values,
            } as any,
          },
        });
        depCount++;
      }
    }
  }

  console.log(`✓ Seeded ${depCount} question dependencies`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🏗  ARC Corpus Loader\n");

  const sectionMap = await seedSections();
  await seedPatterns();
  const slugToVersionId = await seedQuestions(sectionMap);
  await seedDependencies(slugToVersionId);

  console.log("\n✅ Corpus seeded successfully");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
