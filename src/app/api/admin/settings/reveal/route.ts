import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readEnvLocal } from "@/lib/env-file";

export const runtime = "nodejs";

const KEYS: { settingKey: string; envVar: string }[] = [
  { settingKey: "openrouter_api_key", envVar: "OPENROUTER_API_KEY" },
  { settingKey: "github_token", envVar: "GITHUB_TOKEN" },
  { settingKey: "supabase_url", envVar: "SUPABASE_URL" },
  { settingKey: "supabase_service_role_key", envVar: "SUPABASE_SERVICE_ROLE_KEY" },
];

const KEY_BY_NAME = new Map(KEYS.map((k) => [k.settingKey, k]));

/**
 * POST /api/admin/settings/reveal
 *
 * Returns the unmasked effective value for one setting key, used by the
 * Copy-to-clipboard button on /admin/settings. Lookup order matches the
 * runtime: env value preferred, falling back to the DB row.
 *
 * The pseudo-key "database_url" returns the env-only DATABASE_URL.
 *
 * Body: { key: string }
 */
export async function POST(req: NextRequest) {
  const { key } = (await req.json()) as { key?: string };
  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const envValues = await readEnvLocal();

  if (key === "database_url") {
    const v = envValues["DATABASE_URL"] ?? process.env.DATABASE_URL ?? "";
    return NextResponse.json({ value: v });
  }

  const spec = KEY_BY_NAME.get(key);
  if (!spec) {
    return NextResponse.json(
      { error: `Unknown setting key: ${key}` },
      { status: 400 }
    );
  }

  const envValue = envValues[spec.envVar] ?? "";
  const dbValue = envValue
    ? ""
    : (
        await prisma.adminSetting.findUnique({ where: { key: spec.settingKey } })
      )?.value ?? "";

  return NextResponse.json({ value: envValue || dbValue });
}
