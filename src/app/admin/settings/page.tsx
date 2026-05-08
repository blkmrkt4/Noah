"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, Input, PageTitle, SectionTitle } from "@/components/ui";

interface SettingRow {
  settingKey: string;
  envVar: string;
  sensitive: boolean;
  hasDbValue: boolean;
  hasEnvValue: boolean;
  displayValue: string | null;
  updatedAt: string | null;
}

interface SettingsResponse {
  settings: SettingRow[];
  databaseUrl: string | null;
}

interface KeyDef {
  settingKey: string;
  title: string;
  placeholder: string;
  description: string;
}

const GROUPS: { label: string; keys: KeyDef[] }[] = [
  {
    label: "Storage (Supabase)",
    keys: [
      {
        settingKey: "supabase_url",
        title: "Supabase URL",
        placeholder: "https://<project-ref>.supabase.co",
        description:
          "Your Supabase project URL. Used by the storage layer for document uploads.",
      },
      {
        settingKey: "supabase_service_role_key",
        title: "Supabase Service Role Key",
        placeholder: "sb_secret_… or eyJhbGciOi…",
        description:
          "Project Settings → API Keys. Use the new Secret key (sb_secret_…) under \"Publishable and secret API keys\", or the legacy service_role JWT under \"Legacy anon, service_role API keys\" — either works. NOT the Publishable key, NOT the anon key, NOT JWT Keys. Bypasses RLS; treat like a password.",
      },
    ],
  },
  {
    label: "LLM (OpenRouter)",
    keys: [
      {
        settingKey: "openrouter_api_key",
        title: "OpenRouter API Key",
        placeholder: "sk-or-v1-...",
        description:
          "Required for document extraction, repo scan enrichment, and answer pre-population. Get one at openrouter.ai/keys.",
      },
    ],
  },
  {
    label: "Repository scanning (GitHub)",
    keys: [
      {
        settingKey: "github_token",
        title: "GitHub Personal Access Token",
        placeholder: "ghp_...",
        description:
          "Optional. Without it, public-repo scans share the 60/hr unauthenticated rate limit. Read-only scopes are sufficient.",
      },
    ],
  },
];

export default function AdminSettingsPage() {
  const [data, setData] = useState<SettingsResponse | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const res = await fetch("/api/admin/settings");
    setData(await res.json());
  }

  const settingByKey = new Map((data?.settings ?? []).map((s) => [s.settingKey, s]));

  return (
    <div className="px-6 py-8 max-w-3xl space-y-6">
      <PageTitle>Settings</PageTitle>
      <p className="text-sm text-ey-light-gray">
        Each key is saved to the database (so you can see what&rsquo;s configured) and written to{" "}
        <code className="text-ey-yellow font-mono">.env.local</code> (so the running app
        picks it up without manual file edits).
      </p>

      {/* Read-only DATABASE_URL */}
      <Card>
        <SectionTitle>Database</SectionTitle>
        <p className="text-sm text-ey-light-gray mb-3">
          <code className="text-ey-yellow font-mono">DATABASE_URL</code> is required at boot
          and can&rsquo;t be edited from the app. Manage it in{" "}
          <code className="text-ey-yellow font-mono">.env.local</code> directly.
        </p>
        <div className="text-sm flex items-baseline gap-2 flex-wrap">
          <span className="text-ey-sonic-silver">Current value: </span>
          <code className="text-ey-yellow font-mono break-all">
            {data?.databaseUrl ?? "Not set"}
          </code>
          {data?.databaseUrl && <CopyButton settingKey="database_url" />}
        </div>
      </Card>

      {GROUPS.map((group) => (
        <Card key={group.label}>
          <SectionTitle>{group.label}</SectionTitle>
          <div className="space-y-6">
            {group.keys.map((def) => {
              const row = settingByKey.get(def.settingKey);
              return (
                <SettingItem
                  key={def.settingKey}
                  def={def}
                  row={row}
                  onSaved={load}
                />
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}

function SettingItem({
  def,
  row,
  onSaved,
}: {
  def: KeyDef;
  row: SettingRow | undefined;
  onSaved: () => Promise<void> | void;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  async function save() {
    if (!value.trim()) return;
    setSaving(true);
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: def.settingKey, value: value.trim() }),
    });
    if (res.ok) {
      setValue("");
      await onSaved();
      setSavedAt(new Date().toLocaleTimeString());
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Save failed");
    }
    setSaving(false);
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h3 className="text-white font-semibold">{def.title}</h3>
        <code className="text-[11px] text-ey-sonic-silver font-mono shrink-0">
          {row?.envVar}
        </code>
      </div>
      <p className="text-xs text-ey-light-gray mb-3">{def.description}</p>

      <div className="flex items-center gap-2 mb-3 text-xs">
        <span className="text-ey-sonic-silver">Status:</span>
        {row?.hasEnvValue ? (
          <Badge color="green">in .env.local</Badge>
        ) : (
          <Badge color="red">missing in .env.local</Badge>
        )}
        {row?.hasDbValue ? (
          <Badge color="blue">in DB</Badge>
        ) : (
          <Badge color="default">not in DB</Badge>
        )}
      </div>

      <div className="text-sm mb-3 flex items-baseline gap-2 flex-wrap">
        <span className="text-ey-sonic-silver">Current value: </span>
        <code className="text-ey-yellow font-mono break-all">
          {row?.displayValue ?? "Not set"}
        </code>
        {row?.displayValue && <CopyButton settingKey={def.settingKey} />}
      </div>

      <div className="space-y-2">
        <Input
          label="New value"
          name={def.settingKey}
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={def.placeholder}
        />
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving || !value.trim()}>
            {saving ? "Saving..." : "Save"}
          </Button>
          {savedAt && <span className="text-xs text-frame-green">Saved at {savedAt}</span>}
        </div>
      </div>
    </div>
  );
}

function CopyButton({ settingKey }: { settingKey: string }) {
  const [state, setState] = useState<"idle" | "busy" | "copied" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function copy() {
    setState("busy");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/settings/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: settingKey }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.value) {
        setState("error");
        setErrorMsg(json.error ?? "Nothing to copy");
        setTimeout(() => setState("idle"), 1800);
        return;
      }
      await navigator.clipboard.writeText(json.value);
      setState("copied");
      setTimeout(() => setState("idle"), 1500);
    } catch (e) {
      setState("error");
      setErrorMsg((e as Error).message);
      setTimeout(() => setState("idle"), 1800);
    }
  }

  const label =
    state === "busy"
      ? "Copying…"
      : state === "copied"
        ? "Copied"
        : state === "error"
          ? errorMsg ?? "Error"
          : "Copy";

  return (
    <button
      type="button"
      onClick={copy}
      disabled={state === "busy"}
      className={`text-[11px] hover:underline disabled:opacity-50 ${
        state === "copied"
          ? "text-frame-green"
          : state === "error"
            ? "text-frame-red"
            : "text-ey-yellow"
      }`}
    >
      {label}
    </button>
  );
}
