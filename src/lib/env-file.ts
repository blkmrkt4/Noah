/**
 * Reads and writes .env.local atomically. Used by /admin/settings so the user
 * has a single UI for managing keys and doesn't have to edit a dotenv file by hand.
 *
 * Writes are double-quoted to handle values with special characters; existing
 * comments and unrelated lines are preserved.
 */

import { promises as fs } from "fs";
import path from "path";

const ENV_PATH = path.resolve(process.cwd(), ".env.local");

function quote(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
  return `"${escaped}"`;
}

function unquote(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\n/g, "\n")
      .replace(/\\\\/g, "\\");
  }
  return trimmed;
}

async function readLines(): Promise<string[]> {
  try {
    const content = await fs.readFile(ENV_PATH, "utf-8");
    return content.split("\n");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export async function setEnvLocal(key: string, value: string): Promise<void> {
  const lines = await readLines();
  const newLine = `${key}=${quote(value)}`;
  let replaced = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    if (trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    if (trimmed.slice(0, eq).trim() === key) {
      lines[i] = newLine;
      replaced = true;
      break;
    }
  }
  if (!replaced) {
    if (lines.length > 0 && lines[lines.length - 1].trim() !== "") lines.push("");
    lines.push(newLine);
  }
  // Trailing newline for POSIX friendliness.
  const out = lines.join("\n");
  await fs.writeFile(ENV_PATH, out.endsWith("\n") ? out : out + "\n", "utf-8");

  // Mutate the running process so subsequent handlers see the new value
  // without restart. Cleared caches in dependent libraries should re-read.
  process.env[key] = value;
}

export async function readEnvLocal(): Promise<Record<string, string>> {
  const lines = await readLines();
  const result: Record<string, string> = {};
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const value = unquote(line.slice(eq + 1));
    if (key) result[key] = value;
  }
  return result;
}

export async function envLocalKeys(): Promise<string[]> {
  return Object.keys(await readEnvLocal());
}
