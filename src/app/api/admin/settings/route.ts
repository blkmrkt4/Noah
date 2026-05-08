import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readEnvLocal, setEnvLocal } from "@/lib/env-file";
import { clearKeyCache } from "@/lib/openrouter";
import { clearStorageCache } from "@/lib/storage";

export const runtime = "nodejs";

interface KeySpec {
  /** Stable lowercase identifier used in admin_settings.key */
  settingKey: string;
  /** Matching uppercase key in .env.local / process.env */
  envVar: string;
  sensitive: boolean;
}

const KEYS: KeySpec[] = [
  { settingKey: "openrouter_api_key", envVar: "OPENROUTER_API_KEY", sensitive: true },
  { settingKey: "github_token", envVar: "GITHUB_TOKEN", sensitive: true },
  { settingKey: "supabase_url", envVar: "SUPABASE_URL", sensitive: false },
  {
    settingKey: "supabase_service_role_key",
    envVar: "SUPABASE_SERVICE_ROLE_KEY",
    sensitive: true,
  },
];

const KEY_BY_NAME = new Map(KEYS.map((k) => [k.settingKey, k]));

function mask(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "•".repeat(value.length);
  return `${"•".repeat(8)}${value.slice(-4)}`;
}

export async function GET() {
  const dbRows = await prisma.adminSetting.findMany();
  const envValues = await readEnvLocal();
  const dbByKey = new Map(dbRows.map((r) => [r.key, r]));

  const settings = KEYS.map((spec) => {
    const dbValue = dbByKey.get(spec.settingKey)?.value ?? "";
    const envValue = envValues[spec.envVar] ?? "";
    // The value the runtime will actually use is the env value.
    const effective = envValue || dbValue;
    return {
      settingKey: spec.settingKey,
      envVar: spec.envVar,
      sensitive: spec.sensitive,
      hasDbValue: !!dbValue,
      hasEnvValue: !!envValue,
      displayValue: effective ? (spec.sensitive ? mask(effective) : effective) : null,
      updatedAt: dbByKey.get(spec.settingKey)?.updatedAt ?? null,
    };
  });

  // DATABASE_URL is read-only — needed at boot, can't be managed via the app.
  const databaseUrl = envValues["DATABASE_URL"] ?? process.env.DATABASE_URL ?? "";

  return NextResponse.json({
    settings,
    databaseUrl: databaseUrl ? mask(databaseUrl) : null,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { key, value } = body;

  const spec = KEY_BY_NAME.get(key);
  if (!spec) {
    return NextResponse.json(
      { error: `Unknown setting key: ${key}. Allowed: ${[...KEY_BY_NAME.keys()].join(", ")}` },
      { status: 400 }
    );
  }

  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return NextResponse.json({ error: "value cannot be empty" }, { status: 400 });
  }

  await prisma.adminSetting.upsert({
    where: { key: spec.settingKey },
    create: { key: spec.settingKey, value: trimmed, isSensitive: spec.sensitive },
    update: { value: trimmed, isSensitive: spec.sensitive },
  });

  await setEnvLocal(spec.envVar, trimmed);

  if (spec.settingKey === "openrouter_api_key") clearKeyCache();
  if (
    spec.settingKey === "supabase_url" ||
    spec.settingKey === "supabase_service_role_key"
  ) {
    clearStorageCache();
  }

  return NextResponse.json({
    settingKey: spec.settingKey,
    envVar: spec.envVar,
    displayValue: spec.sensitive ? mask(trimmed) : trimmed,
    hasDbValue: true,
    hasEnvValue: true,
  });
}
