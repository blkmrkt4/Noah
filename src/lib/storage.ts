/**
 * Supabase Storage helper. Uses the service-role key for backend writes
 * (bypasses RLS). The bucket is private — downloads happen via signed URLs.
 *
 * Credentials resolve in this order:
 *  1. process.env (set at boot, e.g. by .env.local or hosting provider)
 *  2. admin_settings table (entered via /admin/settings — no restart needed)
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { prisma } from "./prisma";

const BUCKET = "project-docs";

let cached: SupabaseClient | null = null;

async function loadCredentials(): Promise<{ url: string; key: string } | null> {
  const envUrl = process.env.SUPABASE_URL;
  const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (envUrl && envKey) return { url: envUrl, key: envKey };

  const [urlSetting, keySetting] = await Promise.all([
    prisma.adminSetting.findUnique({ where: { key: "supabase_url" } }),
    prisma.adminSetting.findUnique({ where: { key: "supabase_service_role_key" } }),
  ]);
  const url = urlSetting?.value || envUrl || "";
  const key = keySetting?.value || envKey || "";
  if (!url || !key) return null;
  return { url, key };
}

async function getClient(): Promise<SupabaseClient> {
  if (cached) return cached;
  const creds = await loadCredentials();
  if (!creds) {
    throw new Error(
      "Supabase URL and Service Role Key are not configured. Open /admin/settings and enter both under \"Storage (Supabase)\"."
    );
  }
  cached = createClient(creds.url, creds.key, {
    auth: { persistSession: false },
  });
  return cached;
}

export function clearStorageCache() {
  cached = null;
}

export async function ensureBucket(): Promise<void> {
  const client = await getClient();
  const { data, error } = await client.storage.getBucket(BUCKET);
  if (data) return;
  if (error && !/not\s*found|does not exist/i.test(error.message)) {
    throw error;
  }
  const { error: createErr } = await client.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: 50 * 1024 * 1024,
  });
  if (createErr) throw createErr;
}

export async function uploadFile(
  path: string,
  bytes: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  const client = await getClient();
  const { error } = await client.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert: false,
  });
  if (error) throw error;
  return `supabase://${BUCKET}/${path}`;
}

export async function downloadFile(uri: string): Promise<Buffer> {
  const path = stripUri(uri);
  const client = await getClient();
  const { data, error } = await client.storage.from(BUCKET).download(path);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}

export async function signedUrl(uri: string, expiresInSeconds = 60 * 60): Promise<string> {
  const path = stripUri(uri);
  const client = await getClient();
  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

function stripUri(uri: string): string {
  const prefix = `supabase://${BUCKET}/`;
  return uri.startsWith(prefix) ? uri.slice(prefix.length) : uri;
}
