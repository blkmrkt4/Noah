"use client";

import { useEffect, useState } from "react";
import { Button, Card, Input, PageTitle } from "@/components/ui";

interface Prompt {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  userPromptTemplate: string;
}

const empty = {
  slug: "",
  name: "",
  description: "",
  systemPrompt: "",
  userPromptTemplate: "",
};

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoadError(false);
    try {
      const res = await fetch("/api/admin/prompts");
      if (!res.ok) throw new Error(`${res.status}`);
      setPrompts(await res.json());
    } catch {
      setLoadError(true);
    }
  }

  function startCreate() {
    setEditing("new");
    setForm(empty);
  }

  function startEdit(p: Prompt) {
    setEditing(p.id);
    setForm({
      slug: p.slug,
      name: p.name,
      description: p.description ?? "",
      systemPrompt: p.systemPrompt,
      userPromptTemplate: p.userPromptTemplate,
    });
  }

  async function save() {
    setSaving(true);
    const payload = {
      slug: form.slug.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      systemPrompt: form.systemPrompt,
      userPromptTemplate: form.userPromptTemplate,
    };
    const url = editing === "new" ? "/api/admin/prompts" : `/api/admin/prompts/${editing}`;
    const method = editing === "new" ? "POST" : "PUT";
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await load();
    setEditing(null);
    setSaving(false);
  }

  async function remove(id: string) {
    if (!confirm("Delete this prompt?")) return;
    const res = await fetch(`/api/admin/prompts/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? "Delete failed");
      return;
    }
    await load();
  }

  return (
    <div className="px-6 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <PageTitle>Prompts</PageTitle>
        <Button onClick={startCreate}>+ New prompt</Button>
      </div>

      <p className="text-sm text-ey-light-gray mb-4">
        Reusable prompt templates referenced by slug. Use{" "}
        <code className="text-ey-yellow">{"{{variable}}"}</code> placeholders in
        the user template; the runtime substitutes them at call time.
      </p>

      <Card className="mb-6 border-ey-yellow/30 bg-ey-yellow/5">
        <h3 className="text-ey-yellow text-sm font-semibold mb-2">
          Bind <code className="font-mono">policy-more-info-extract</code> — recommended output shape
        </h3>
        <p className="text-xs text-ey-light-gray mb-2">
          The Guidance editor renders two markdown sections. Write the user
          template so the model produces both:
        </p>
        <pre className="text-[11px] text-ey-light-gray bg-black p-3 rounded font-mono whitespace-pre-wrap leading-relaxed">{`Output exactly two sections in markdown:

## Description
A concise distillation of what {{policy_title}} says about
"{{question_prompt}}" — clearer than the source, focused on what
the Commercial Owner needs to know to answer well.

## Example
A practical, non-trivial example of how another product
satisfied this — including why it mattered. Skip this section
only if the policy has no concrete guidance to illustrate.`}</pre>
        <p className="text-[11px] text-ey-sonic-silver mt-2">
          Available variables for this bind:{" "}
          <code className="text-ey-light-gray">question_prompt</code>,{" "}
          <code className="text-ey-light-gray">question_slug</code>,{" "}
          <code className="text-ey-light-gray">section_name</code>,{" "}
          <code className="text-ey-light-gray">policy_title</code>,{" "}
          <code className="text-ey-light-gray">policy_text</code>.
        </p>
      </Card>

      {editing && (
        <Card className="mb-6">
          <h3 className="text-ey-yellow font-semibold mb-4">
            {editing === "new" ? "New prompt" : "Edit prompt"}
          </h3>
          <div className="space-y-3">
            <Input
              label="Slug"
              name="slug"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="doc-extraction"
              required
            />
            <Input
              label="Name"
              name="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Document extraction"
              required
            />
            <Input
              label="Description"
              name="description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <TextArea
              label="System prompt"
              value={form.systemPrompt}
              onChange={(v) => setForm({ ...form, systemPrompt: v })}
              rows={6}
              required
            />
            <TextArea
              label="User prompt template"
              value={form.userPromptTemplate}
              onChange={(v) => setForm({ ...form, userPromptTemplate: v })}
              rows={10}
              helpText="Use {{variable}} placeholders. Available vars depend on the bind."
              required
            />
            <div className="flex gap-3 pt-2">
              <Button
                onClick={save}
                disabled={
                  saving ||
                  !form.slug ||
                  !form.name ||
                  !form.systemPrompt ||
                  !form.userPromptTemplate
                }
              >
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button variant="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {prompts.map((p) => (
          <Card key={p.id}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-baseline gap-3">
                  <h3 className="text-white font-semibold">{p.name}</h3>
                  <code className="text-xs text-ey-yellow font-mono">{p.slug}</code>
                </div>
                {p.description && (
                  <p className="text-sm text-ey-light-gray mt-1">{p.description}</p>
                )}
                <details className="mt-2">
                  <summary className="text-xs text-ey-sonic-silver cursor-pointer hover:text-ey-yellow">
                    Show prompts
                  </summary>
                  <pre className="text-xs text-ey-light-gray bg-black p-3 rounded mt-2 whitespace-pre-wrap font-mono">
                    <strong className="text-ey-yellow">System:</strong>
                    {"\n"}
                    {p.systemPrompt}
                    {"\n\n"}
                    <strong className="text-ey-yellow">User:</strong>
                    {"\n"}
                    {p.userPromptTemplate}
                  </pre>
                </details>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => startEdit(p)}>
                  Edit
                </Button>
                <Button variant="danger" onClick={() => remove(p.id)}>
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {loadError && (
          <Card>
            <p className="text-frame-red text-sm">Unable to load prompts — database may be unreachable.</p>
            <Button variant="secondary" className="mt-2" onClick={() => load()}>Retry</Button>
          </Card>
        )}
        {!loadError && prompts.length === 0 && (
          <p className="text-sm text-ey-sonic-silver">No prompts defined yet. Run <code className="text-ey-yellow">npm run db:seed-admin</code> to seed defaults.</p>
        )}
      </div>
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 4,
  helpText,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  helpText?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-ey-light-gray">
        {label}
        {required && <span className="text-frame-red ml-1">*</span>}
      </label>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-black border border-ey-sonic-silver/50 text-white font-mono text-sm placeholder:text-ey-sonic-silver focus:outline-none focus:border-ey-yellow/50 transition-colors"
      />
      {helpText && <p className="text-xs text-ey-sonic-silver">{helpText}</p>}
    </div>
  );
}
