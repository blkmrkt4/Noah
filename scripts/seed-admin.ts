/**
 * Seed default Models, Prompts, and Binds so the LLM pipeline works out of the box.
 * Idempotent — safe to re-run. Edits in /admin won't be overwritten.
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "fs";
import { join } from "path";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" });
const prisma = new (PrismaClient as any)({ adapter }) as PrismaClient;

const SYSTEM_JSON =
  "You are a structured data extraction assistant. Always respond with valid JSON only, no markdown fences or explanation.";

const SYSTEM_POLICY_PROSE =
  "You are a policy interpreter helping a Commercial Owner understand what a risk-attestation question is asking, grounded in the actual policy text. Write in plain professional prose — no markdown headers, no bullet lists, no preamble. Two to four sentences. If the supplied policy text does not address the question, say so plainly. Never speculate beyond what the policy text states.";

const PROMPTS_DIR = join(__dirname, "..", "prisma", "prompts");
const REPO_SCAN_TECHNICAL_PROMPT = readFileSync(
  join(PROMPTS_DIR, "repo-scan-technical.md"),
  "utf8"
);
const REPO_SCAN_RISK_REVIEW_PROMPT = readFileSync(
  join(PROMPTS_DIR, "repo-scan-risk-review.md"),
  "utf8"
);

const MODELS = [
  {
    openrouterModelId: "anthropic/claude-sonnet-4",
    name: "Sonnet 4 (heavy)",
    description: "Best for complex reasoning and document analysis.",
    temperature: 0.2,
    maxTokens: 4096,
  },
  {
    openrouterModelId: "qwen/qwen3-235b-a22b",
    name: "Qwen 3 235B (medium)",
    description: "Cost-effective for extraction and pre-population.",
    temperature: 0.2,
    maxTokens: 4096,
  },
  {
    openrouterModelId: "qwen/qwen3-30b-a3b",
    name: "Qwen 3 30B (light)",
    description: "Cheap classification and yes/no calls.",
    temperature: 0.1,
    maxTokens: 2048,
  },
];

const PROMPTS = [
  {
    slug: "doc-extraction",
    name: "Document extraction",
    description:
      "Extracts a summary and structured facts from an uploaded document for use as evidence.",
    systemPrompt: SYSTEM_JSON,
    userPromptTemplate: `Extract structured facts from this document that would be relevant to a risk attestation questionnaire.

Document: {{filename}} ({{mimeType}})
Project: {{projectName}}

Return a JSON object with:
- "summary": a 2-3 sentence summary of the document's relevance to risk assessment
- "facts": an array of objects, each with "category" (data_classification, ai_usage, hosting, audience, etc.), "claim" (the factual statement), and "confidence" (0-1)

Document content:
{{content}}`,
  },
  {
    slug: "repo-scan",
    name: "Repository scan",
    description: "Identifies AI deps, licenses, security config, and infra indicators in a code repo.",
    systemPrompt: SYSTEM_JSON,
    userPromptTemplate: `Analyze this repository for risk assessment findings.

Repository: {{repoUrl}}

Identify:
1. AI/ML dependencies (tensorflow, pytorch, langchain, openai, etc.)
2. Open source licenses that may be copyleft
3. Data handling patterns (encryption, storage, PII markers)
4. Security configuration (auth, secrets management)
5. Infrastructure/hosting indicators

Return a JSON array of findings, each with: "finding_type", "evidence", "file_path" (if applicable), "line_number" (if applicable).

Repository content:
{{content}}`,
  },
  {
    slug: "answer-prepopulation",
    name: "Answer pre-population",
    description: "Answers a single questionnaire question from accumulated evidence.",
    systemPrompt: SYSTEM_JSON,
    userPromptTemplate: `Based on the evidence below, answer this risk assessment question.

Question: {{questionPrompt}}
Answer type: {{answerType}}
Options: {{options}}

Return JSON with:
- "value": the answer value (must match the answer_type format)
- "confidence": 0-1 confidence score
- "citation": brief citation of which evidence supports this answer

If you cannot determine an answer from the evidence, return {"value": null, "confidence": 0, "citation": "Insufficient evidence"}

Evidence:
{{evidence}}`,
  },
  {
    slug: "policy-more-info-extract",
    name: "Policy more-info snippet",
    description:
      "Generates the 2–4 sentence prose snippet shown when a Commercial Owner clicks the (i) icon on a question. Reads the mapped policy text and explains what the question is really asking for, in policy terms.",
    systemPrompt: SYSTEM_POLICY_PROSE,
    userPromptTemplate: `A Commercial Owner is being asked the following question in the {{section_name}} section of a risk attestation:

"{{question_prompt}}"
(slug: {{question_slug}})

Below is the relevant policy text. Using only what the policy says, explain in 2–4 sentences what this question is really asking for and what the policy expects. Do not speculate beyond the policy text. If the policy is silent on this specific question, write exactly: "The supplied policy does not directly address this question."

Policy text:
{{policy_text}}`,
  },
  {
    slug: "repo-scan-technical",
    name: "Repo scan — technical description",
    description:
      "Produces an evidence-cited human-readable Markdown technical analysis of a GitHub repo for ARC intake — project summary, codebase inventory, repo findings (grouped by the eight ARC risk categories), discrepancies, persona summaries. Output is Markdown prose, not JSON. Source markdown for the system prompt lives at prisma/prompts/repo-scan-technical.md.",
    systemPrompt: REPO_SCAN_TECHNICAL_PROMPT,
    userPromptTemplate: `Repository URL: {{repoUrl}}
Project: {{projectName}}
Scope: {{scopeType}}

Available evidence assembled from the local repo scanner and any uploaded project documents. This stands in for the repository content you would otherwise read directly. Treat each "[Repo finding]" line as a fact observed in the repo at the cited file path; treat each "[Document]" entry as a Commercial-Owner-supplied context document.

{{evidence}}

Produce the human-readable Markdown document described in the system prompt. Cite specific file paths inside the evidence block whenever possible (for example, "package.json", ".github/workflows/ci.yml"). Where evidence is silent on a topic, say so explicitly — silence is not absence. Output Markdown prose only — no JSON, no code fences wrapping the whole document.`,
  },
  {
    slug: "repo-scan-risk-review",
    name: "Repo scan — reviewer risk review",
    description:
      "Produces a plain-English reviewer-facing summary of a GitHub repo for ARC reviewers. Output is markdown prose. Source markdown lives at prisma/prompts/repo-scan-risk-review.md.",
    systemPrompt: REPO_SCAN_RISK_REVIEW_PROMPT,
    userPromptTemplate: `Repository URL: {{repoUrl}}
Project: {{projectName}}
Scope: {{scopeType}}

Available evidence assembled from the local repo scanner and any uploaded project documents:

{{evidence}}

Produce the plain-English reviewer document described in the system prompt. Output markdown only — no JSON, no code fences around the whole document.`,
  },
];

const BINDS: { slug: string; name: string; modelId: string; promptSlug: string }[] = [
  {
    slug: "doc-extraction",
    name: "Document extraction",
    modelId: "anthropic/claude-sonnet-4",
    promptSlug: "doc-extraction",
  },
  {
    slug: "repo-scan",
    name: "Repository scan",
    modelId: "qwen/qwen3-235b-a22b",
    promptSlug: "repo-scan",
  },
  {
    slug: "answer-prepopulation",
    name: "Answer pre-population",
    modelId: "qwen/qwen3-235b-a22b",
    promptSlug: "answer-prepopulation",
  },
  {
    slug: "policy-more-info-extract",
    name: "Policy more-info snippet",
    modelId: "anthropic/claude-sonnet-4",
    promptSlug: "policy-more-info-extract",
  },
  {
    slug: "repo-scan-technical",
    name: "Repo scan — technical description",
    modelId: "anthropic/claude-sonnet-4",
    promptSlug: "repo-scan-technical",
  },
  {
    slug: "repo-scan-risk-review",
    name: "Repo scan — reviewer risk review",
    modelId: "anthropic/claude-sonnet-4",
    promptSlug: "repo-scan-risk-review",
  },
];

async function main() {
  console.log("🛠  Admin defaults seed");

  for (const m of MODELS) {
    await prisma.modelLibrary.upsert({
      where: { openrouterModelId: m.openrouterModelId },
      create: m,
      update: { name: m.name, description: m.description },
    });
  }
  console.log(`✓ Seeded ${MODELS.length} models`);

  for (const p of PROMPTS) {
    // Always push the latest content from the repo. This makes the seed
    // script (and the markdown files in prisma/prompts/) the source of
    // truth for prompts. Anyone editing in /admin should know the next
    // db:seed-admin will overwrite their changes — promote good edits back
    // into the file rather than leaving them orphaned in the DB.
    await prisma.promptLibrary.upsert({
      where: { slug: p.slug },
      create: p,
      update: {
        name: p.name,
        description: p.description,
        systemPrompt: p.systemPrompt,
        userPromptTemplate: p.userPromptTemplate,
      },
    });
  }
  console.log(`✓ Seeded ${PROMPTS.length} prompts`);

  for (const b of BINDS) {
    const model = await prisma.modelLibrary.findUnique({
      where: { openrouterModelId: b.modelId },
    });
    const prompt = await prisma.promptLibrary.findUnique({ where: { slug: b.promptSlug } });
    if (!model || !prompt) {
      console.warn(`⚠ Skipping bind ${b.slug} — model or prompt not found`);
      continue;
    }
    await prisma.activityBind.upsert({
      where: { slug: b.slug },
      create: { slug: b.slug, name: b.name, modelId: model.id, promptId: prompt.id },
      update: { name: b.name },
    });
  }
  console.log(`✓ Seeded ${BINDS.length} binds`);

  console.log("\n✅ Admin defaults ready. Set your OpenRouter key at /admin/settings.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
