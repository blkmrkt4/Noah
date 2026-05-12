/**
 * GitHub repository scanner. Walks top-level package manifests + license files
 * via the GitHub REST API and produces objective RepoFinding records pinned
 * to a commit SHA.
 *
 * Optional GitHub PAT lives in admin_settings (key "github_token") and bumps
 * the rate limit from 60/hr to 5000/hr. Scanning is read-only.
 */

import { prisma } from "./prisma";

export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
}

export function parseGitHubUrl(url: string): ParsedGitHubUrl {
  const cleaned = url.trim().replace(/\.git$/, "").replace(/\/$/, "");
  const m = cleaned.match(/github\.com[/:]([\w.-]+)\/([\w.-]+)$/);
  if (!m) throw new Error(`Not a recognizable GitHub URL: ${url}`);
  return { owner: m[1], repo: m[2] };
}

export interface RepoScanFinding {
  findingType: string;
  evidence: string;
  filePath?: string;
}

export interface RepoScanResult {
  commitSha: string;
  defaultBranch: string;
  findings: RepoScanFinding[];
}

const MANIFESTS = [
  "package.json",
  "requirements.txt",
  "pyproject.toml",
  "Pipfile",
  "go.mod",
  "Cargo.toml",
  "Gemfile",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "composer.json",
];

const LICENSE_FILES = ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING"];

const AI_LIBRARIES = [
  "tensorflow",
  "torch",
  "pytorch",
  "scikit-learn",
  "transformers",
  "huggingface",
  "langchain",
  "langgraph",
  "openai",
  "anthropic",
  "@anthropic-ai/sdk",
  "mistralai",
  "cohere",
  "ollama",
  "llamaindex",
  "llama-index",
  "sentence-transformers",
  "spacy",
  "diffusers",
  "ai-sdk",
];

const COPYLEFT_TOKENS = ["GPL", "AGPL", "LGPL", "MPL", "EPL", "CDDL"];

const HOSTING_HINTS = [
  "aws",
  "amazon web services",
  "gcp",
  "google cloud",
  "azure",
  "heroku",
  "vercel",
  "fly.io",
  "netlify",
  "render.com",
  "supabase",
  "railway",
];

async function getGitHubToken(): Promise<string | null> {
  try {
    const setting = await prisma.adminSetting.findUnique({
      where: { key: "github_token" },
    });
    return setting?.value || null;
  } catch {
    return null;
  }
}

async function ghFetch<T>(path: string): Promise<T> {
  const token = await getGitHubToken();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "ART-RepoScanner",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status} on ${path}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

interface GhContentFile {
  type: string;
  encoding?: string;
  content?: string;
  size: number;
}

async function getFileContent(
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<string | null> {
  try {
    const data = await ghFetch<GhContentFile | GhContentFile[]>(
      `/repos/${owner}/${repo}/contents/${path}?ref=${ref}`
    );
    if (Array.isArray(data) || data.type !== "file" || !data.content) return null;
    if (data.encoding !== "base64") return null;
    return Buffer.from(data.content, "base64").toString("utf-8");
  } catch {
    return null;
  }
}

function extractDependencies(manifest: string, content: string): string[] {
  if (manifest === "package.json") {
    try {
      const pkg = JSON.parse(content);
      return [
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.devDependencies || {}),
        ...Object.keys(pkg.peerDependencies || {}),
      ];
    } catch {
      return [];
    }
  }
  if (manifest === "requirements.txt") {
    return content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => l.split(/[<>=!~\s]/)[0]!)
      .filter(Boolean);
  }
  if (manifest === "pyproject.toml" || manifest === "Pipfile") {
    const matches = Array.from(content.matchAll(/^\s*([a-zA-Z][\w-]*)\s*=/gm));
    return matches.map((m) => m[1]);
  }
  if (manifest === "go.mod") {
    return content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^(github\.com|golang\.org|gopkg\.in)/.test(l))
      .map((l) => l.split(/\s+/)[0]!);
  }
  if (manifest === "Cargo.toml") {
    const section = content.split(/\[dependencies\]/)[1]?.split(/^\[/m)[0] ?? "";
    const matches = Array.from(section.matchAll(/^\s*([a-zA-Z][\w-]*)\s*=/gm));
    return matches.map((m) => m[1]);
  }
  if (manifest === "Gemfile") {
    const matches = Array.from(content.matchAll(/gem\s+['"]([\w-]+)['"]/g));
    return matches.map((m) => m[1]);
  }
  if (manifest === "composer.json") {
    try {
      const pkg = JSON.parse(content);
      return [
        ...Object.keys(pkg.require || {}),
        ...Object.keys(pkg["require-dev"] || {}),
      ];
    } catch {
      return [];
    }
  }
  return [];
}

function isAiLibrary(dep: string): boolean {
  const lower = dep.toLowerCase();
  return AI_LIBRARIES.some((lib) => lower === lib || lower.includes(lib));
}

interface GhRepoMeta {
  default_branch: string;
}
interface GhCommit {
  sha: string;
}

export async function scanGitHubRepo(repoUrl: string): Promise<RepoScanResult> {
  const { owner, repo } = parseGitHubUrl(repoUrl);

  const meta = await ghFetch<GhRepoMeta>(`/repos/${owner}/${repo}`);
  const defaultBranch = meta.default_branch;
  const commit = await ghFetch<GhCommit>(
    `/repos/${owner}/${repo}/commits/${defaultBranch}`
  );
  const commitSha = commit.sha;

  const findings: RepoScanFinding[] = [];

  // 1. Manifests → dependencies
  for (const manifest of MANIFESTS) {
    const content = await getFileContent(owner, repo, manifest, commitSha);
    if (!content) continue;

    const deps = extractDependencies(manifest, content);
    if (deps.length === 0) continue;

    findings.push({
      findingType: "manifest_present",
      evidence: `${manifest} declares ${deps.length} dependencies`,
      filePath: manifest,
    });

    const aiDeps = deps.filter(isAiLibrary);
    if (aiDeps.length > 0) {
      findings.push({
        findingType: "ai_dependency",
        evidence: `AI/ML libraries detected in ${manifest}: ${aiDeps.join(", ")}`,
        filePath: manifest,
      });
    }

    const sample = deps.slice(0, 25).join(", ");
    findings.push({
      findingType: "dependency_sample",
      evidence: `First ${Math.min(25, deps.length)} of ${deps.length} deps in ${manifest}: ${sample}`,
      filePath: manifest,
    });
  }

  // 2. License files
  for (const licenseFile of LICENSE_FILES) {
    const content = await getFileContent(owner, repo, licenseFile, commitSha);
    if (!content) continue;
    const head = content.slice(0, 1500);
    const copyleft = COPYLEFT_TOKENS.find((t) => head.includes(t));
    findings.push({
      findingType: copyleft ? "copyleft_license" : "license_present",
      evidence: copyleft
        ? `${copyleft}-style license declared at ${licenseFile}`
        : `License file present at ${licenseFile}`,
      filePath: licenseFile,
    });
    break;
  }

  // 3. Containerization
  const dockerfile = await getFileContent(owner, repo, "Dockerfile", commitSha);
  if (dockerfile) {
    findings.push({
      findingType: "containerized",
      evidence: "Dockerfile present at repository root",
      filePath: "Dockerfile",
    });
  }
  const compose = await getFileContent(owner, repo, "docker-compose.yml", commitSha);
  if (compose) {
    findings.push({
      findingType: "containerized",
      evidence: "docker-compose.yml present",
      filePath: "docker-compose.yml",
    });
  }

  // 4. CI presence
  const ciPaths = [".github/workflows", ".gitlab-ci.yml", ".circleci/config.yml"];
  for (const ciPath of ciPaths) {
    const exists = await getFileContent(owner, repo, ciPath, commitSha);
    if (exists !== null || ciPath === ".github/workflows") {
      try {
        const data = await ghFetch<GhContentFile | GhContentFile[]>(
          `/repos/${owner}/${repo}/contents/${ciPath}?ref=${commitSha}`
        );
        const present = Array.isArray(data) ? data.length > 0 : true;
        if (present) {
          findings.push({
            findingType: "ci_configured",
            evidence: `CI config detected at ${ciPath}`,
            filePath: ciPath,
          });
          break;
        }
      } catch {
        // path doesn't exist
      }
    }
  }

  // 5. Hosting hints in README
  const readme =
    (await getFileContent(owner, repo, "README.md", commitSha)) ||
    (await getFileContent(owner, repo, "README", commitSha)) ||
    (await getFileContent(owner, repo, "Readme.md", commitSha));
  if (readme) {
    const lower = readme.toLowerCase();
    const hits = HOSTING_HINTS.filter((h) => lower.includes(h));
    if (hits.length > 0) {
      findings.push({
        findingType: "hosting_indicator",
        evidence: `README references hosting/infra: ${hits.join(", ")}`,
        filePath: "README.md",
      });
    }
  }

  return { commitSha, defaultBranch, findings };
}
