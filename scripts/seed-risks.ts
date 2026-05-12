/**
 * Risk Taxonomy Seeder — creates Risk rows and links them to Questions
 * using section-level defaults + keyword-based overlays.
 *
 * Usage:
 *   npx tsx scripts/seed-risks.ts            # write to database
 *   npx tsx scripts/seed-risks.ts --dry-run  # compute mappings, print summary, don't write
 *
 * Idempotent — safe to re-run. Uses upsert keyed on slug (risks) and
 * composite (questionId, riskId) for join rows.
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

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

const DRY_RUN = process.argv.includes("--dry-run");

const adapter = new PrismaPg({ connectionString: getPostgresUrl() });
const prisma = new (PrismaClient as any)({ adapter }) as InstanceType<typeof PrismaClient>;

// ─── Risk taxonomy ──────────────────────────────────────────────────────────

interface RiskDef {
  slug: string;
  name: string;
  description: string;
  displayOrder: number;
}

const RISKS: RiskDef[] = [
  {
    slug: "regulatory_noncompliance",
    name: "Regulatory Non-Compliance",
    description:
      "Risk that deploying a technology asset breaches binding law in a jurisdiction where EY operates. Covers privacy regimes (GDPR, UK GDPR, LGPD, PIPL, India DPDP, US state privacy laws), AI regulation (EU AI Act tiers, prohibited uses, transparency obligations), cybersecurity and resilience laws (NIS2, DORA, EU Cyber Resilience Act), and sector overlays (financial services, health, public sector, employment). Magnitude is driven by which countries are in scope, the categories of data subjects involved, and the regulatory tier of the use case.",
    displayOrder: 1,
  },
  {
    slug: "independence_violation",
    name: "Independence Violation",
    description:
      "Risk that EY, by deploying or using a technology, places itself in a position of auditing its own work, acting as management, advocating for a client, or holding an impermissible business relationship with a restricted entity. Existential for an audit firm: a breach can disqualify EY from auditing a public-company client and trigger regulatory action from the SEC, PCAOB, or local equivalents. Measured via independence questions, BRIDGE routing, and SORT/GIS checks. Magnitude is often binary — the deployment is either permissible for that client type or it is not.",
    displayOrder: 2,
  },
  {
    slug: "confidentiality_data_rights_breach",
    name: "Confidentiality and Data-Rights Breach",
    description:
      "Risk that EY uses client data, vendor-licensed data, or third-party data in a way the underlying contract does not permit. Examples include training a model on client data outside SOW scope, reusing data across engagements, exposing data to a sub-processor in another country, or retaining data past contract end. Magnitude depends on sensitivity of the data, breadth of the contract violation, and whether the client could detect or be harmed.",
    displayOrder: 3,
  },
  {
    slug: "information_security_resilience",
    name: "Information Security and Operational Resilience",
    description:
      "Risk that the asset is compromised, leaks data, fails when needed, or becomes a vector into the rest of EY's environment. Includes intrinsic security posture, supplier and third-party risk, open-source software risk, and business continuity exposure. Magnitude is driven by data classification (C1 through C4), audience (internal, external, or public), criticality to business operations, and trustworthiness of involved third parties.",
    displayOrder: 4,
  },
  {
    slug: "ip_contract",
    name: "Intellectual Property and Contract",
    description:
      "Risk that EY accidentally transfers ownership of valuable IP, accepts OSS license obligations that conflict with commercial use, ends up with split ownership creating tax/legal/commercial problems, or builds on data it does not have rights to. Magnitude depends on the commercial value of the asset and the cost of unwinding the mistake.",
    displayOrder: 5,
  },
  {
    slug: "reputational_brand",
    name: "Reputational and Brand",
    description:
      "Risk that the asset — by virtue of how it is named, marketed, behaves, or what it produces — damages the EY brand or creates a reputational incident. Includes AI outputs that are wrong or offensive, content conflicting with local norms, naming conflicts with existing rightsholders, accessibility failures that exclude users, and visible operational failures. Magnitude depends on audience size, visibility, and reversibility.",
    displayOrder: 6,
  },
  {
    slug: "quality_fitness_for_purpose",
    name: "Quality and Fitness for Purpose",
    description:
      "Risk that the asset does not work as intended in the specific service-line context where it is deployed, producing wrong outputs that EY professionals then rely on or pass to clients. Measured via AIQRM validation, testing evidence, monitoring plans, and service-line overlay questions. Magnitude depends on how consequential the outputs are (advisory vs decision-making) and whether human review is mandatory.",
    displayOrder: 7,
  },
  {
    slug: "lifecycle_governance",
    name: "Lifecycle and Post-Production Governance",
    description:
      "Risk that an asset, once approved, drifts out of compliance because it changes, expands to new countries, retrains on new data, or ages while the regulatory landscape shifts. Covered by retention, periodic review cadence, change-trigger, and delta-review questions. Magnitude depends on how dynamic the asset is and how visible changes are to governance.",
    displayOrder: 8,
  },
];

// ─── Section-level defaults ─────────────────────────────────────────────────

const SECTION_DEFAULTS: Record<string, string[]> = {
  privacy: ["regulatory_noncompliance", "confidentiality_data_rights_breach"],
  ai: ["regulatory_noncompliance", "quality_fitness_for_purpose"],
  independence: ["independence_violation"],
  security: ["information_security_resilience"],
  brand: ["reputational_brand"],
  accessibility: ["reputational_brand"],
  oss: ["ip_contract"],
  nss: ["information_security_resilience"],
  contracts: ["ip_contract"],
  retention: ["lifecycle_governance", "regulatory_noncompliance"],
  bia: ["information_security_resilience"],
  "service-lines": ["quality_fitness_for_purpose"],
  // intake and triage are foundation — no default risk assignment
};

// ─── Keyword overlays ───────────────────────────────────────────────────────

interface KeywordRule {
  patterns: RegExp;
  risk: string;
}

function kw(words: string[], risk: string): KeywordRule {
  // Build a single regex that matches any of the given phrases, case-insensitive
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return { patterns: new RegExp(escaped.join("|"), "i"), risk };
}

const KEYWORD_RULES: KeywordRule[] = [
  kw(
    ["audit client", "restricted entity", "SORT", "GIS", "BRIDGE", "channel 1", "channel one", "independence"],
    "independence_violation"
  ),
  kw(
    [
      "cross-border", "transfer", "localisation", "localization", "data subject",
      "GDPR", "LGPD", "PIPL", "DPDP", "personal data", "biometric", "profiling",
      "automated decision",
    ],
    "regulatory_noncompliance"
  ),
  kw(
    [
      "client data", "client confidential", "SOW", "CIC", "consent",
      "third-party data", "vendor data", "license", "reuse",
    ],
    "confidentiality_data_rights_breach"
  ),
  kw(
    ["OSS", "open source", "license", "IP", "ownership", "copyright", "contract"],
    "ip_contract"
  ),
  kw(
    [
      "name", "naming", "brand", "marketing", "public", "accessibility", "WCAG",
      "content moderation", "language",
    ],
    "reputational_brand"
  ),
  kw(
    [
      "retention", "delete", "archive", "lifecycle", "periodic review",
      "monitoring", "change", "delta",
    ],
    "lifecycle_governance"
  ),
  kw(
    [
      "validation", "testing", "evidence", "human in the loop", "human review",
      "AIQRM", "QRM",
    ],
    "quality_fitness_for_purpose"
  ),
  kw(
    [
      "security", "InfoSec", "encryption", "C1", "C2", "C3", "C4", "supplier",
      "vendor risk", "SRA", "cloud", "hosting", "BIA",
    ],
    "information_security_resilience"
  ),
];

// ─── Mapping engine ─────────────────────────────────────────────────────────

function computeRisksForQuestion(
  sectionSlug: string,
  questionSlug: string,
  prompt: string
): string[] {
  const risks = new Set<string>();

  // 1. Section-level defaults
  const defaults = SECTION_DEFAULTS[sectionSlug];
  if (defaults) {
    for (const r of defaults) risks.add(r);
  }

  // 2. Keyword overlays — scan both slug and prompt
  const searchText = `${questionSlug} ${prompt}`;
  for (const rule of KEYWORD_RULES) {
    if (rule.patterns.test(searchText)) {
      risks.add(rule.risk);
    }
  }

  return [...risks];
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🏗  ART Risk Taxonomy Seeder${DRY_RUN ? " (DRY RUN)" : ""}\n`);

  // 1. Seed Risk rows
  const riskSlugToId = new Map<string, string>();

  if (!DRY_RUN) {
    for (const r of RISKS) {
      const row = await prisma.risk.upsert({
        where: { slug: r.slug },
        update: {
          name: r.name,
          description: r.description,
          displayOrder: r.displayOrder,
        },
        create: {
          slug: r.slug,
          name: r.name,
          description: r.description,
          displayOrder: r.displayOrder,
        },
      });
      riskSlugToId.set(r.slug, row.id);
    }
    console.log(`✓ Seeded ${RISKS.length} risks`);
  } else {
    // In dry-run, just assign placeholder IDs
    for (const r of RISKS) {
      riskSlugToId.set(r.slug, `<${r.slug}>`);
    }
    console.log(`✓ Would seed ${RISKS.length} risks`);
  }

  // 2. Load all questions with their section slug and latest version prompt
  const questions = await prisma.question.findMany({
    include: {
      section: { select: { slug: true } },
      versions: {
        orderBy: { version: "desc" as const },
        take: 1,
        select: { prompt: true },
      },
    },
  });

  console.log(`  Found ${questions.length} questions in the database\n`);

  // 3. Compute mappings
  const linkCounts = new Map<string, number>();
  for (const r of RISKS) linkCounts.set(r.slug, 0);

  const zeroRiskQuestions: string[] = [];
  const overFourQuestions: { slug: string; count: number; risks: string[] }[] = [];
  let totalLinks = 0;

  const mappings: { questionId: string; questionSlug: string; riskSlugs: string[] }[] = [];

  for (const q of questions) {
    const sectionSlug = q.section.slug;
    const prompt = q.versions[0]?.prompt ?? "";
    const riskSlugs = computeRisksForQuestion(sectionSlug, q.slug, prompt);

    mappings.push({ questionId: q.id, questionSlug: q.slug, riskSlugs });

    if (riskSlugs.length === 0) {
      zeroRiskQuestions.push(q.slug);
    }
    if (riskSlugs.length > 4) {
      overFourQuestions.push({ slug: q.slug, count: riskSlugs.length, risks: riskSlugs });
    }

    totalLinks += riskSlugs.length;
    for (const rs of riskSlugs) {
      linkCounts.set(rs, (linkCounts.get(rs) ?? 0) + 1);
    }
  }

  // 4. Write join rows (unless dry-run)
  if (!DRY_RUN) {
    let written = 0;
    for (const m of mappings) {
      for (const riskSlug of m.riskSlugs) {
        const riskId = riskSlugToId.get(riskSlug);
        if (!riskId) continue;
        await prisma.questionRisk.upsert({
          where: { questionId_riskId: { questionId: m.questionId, riskId } },
          update: {},
          create: { questionId: m.questionId, riskId },
        });
        written++;
      }
    }
    console.log(`✓ Wrote ${written} Question↔Risk links\n`);
  } else {
    console.log(`  Would write ${totalLinks} Question↔Risk links\n`);
  }

  // 5. Summary
  console.log("═══ SUMMARY ═══════════════════════════════════════════════════");
  console.log(`  Risks seeded:          ${RISKS.length}`);
  console.log(`  Questions processed:   ${questions.length}`);
  console.log(`  Total Q↔R links:       ${totalLinks}`);
  console.log("");
  console.log("  Links per risk:");
  for (const [slug, count] of linkCounts) {
    const name = RISKS.find((r) => r.slug === slug)?.name ?? slug;
    console.log(`    ${name.padEnd(48)} ${count}`);
  }

  // 6. Warnings
  if (zeroRiskQuestions.length > 0) {
    console.log(`\n⚠  ${zeroRiskQuestions.length} question(s) with ZERO risk mappings:`);
    for (const slug of zeroRiskQuestions) {
      console.log(`    - ${slug}`);
    }
  }

  if (overFourQuestions.length > 0) {
    console.log(`\n⚠  ${overFourQuestions.length} question(s) with MORE THAN 4 risk mappings:`);
    for (const q of overFourQuestions) {
      console.log(`    - ${q.slug} (${q.count} risks: ${q.risks.join(", ")})`);
    }
  }

  console.log(`\n${DRY_RUN ? "🔍 Dry run complete — no database writes." : "✅ Risk taxonomy seeded successfully."}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
