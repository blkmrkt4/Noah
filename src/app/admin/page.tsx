"use client";

import { useEffect, useState } from "react";
import { Button, Card, Input, PageTitle, Select } from "@/components/ui";

interface Model {
  id: string;
  name: string;
  openrouterModelId: string;
}
interface Prompt {
  id: string;
  slug: string;
  name: string;
}
interface Bind {
  slug: string;
  name: string;
  modelId: string;
  promptId: string;
  model: Model;
  prompt: Prompt;
}

const empty = { slug: "", name: "", modelId: "", promptId: "" };

export default function BindsPage() {
  const [binds, setBinds] = useState<Bind[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const [b, m, p] = await Promise.all([
      fetch("/api/admin/binds").then((r) => r.json()),
      fetch("/api/admin/models").then((r) => r.json()),
      fetch("/api/admin/prompts").then((r) => r.json()),
    ]);
    setBinds(b);
    setModels(m);
    setPrompts(p);
  }

  function startCreate() {
    setEditing("new");
    setForm(empty);
  }

  function startEdit(b: Bind) {
    setEditing(b.slug);
    setForm({ slug: b.slug, name: b.name, modelId: b.modelId, promptId: b.promptId });
  }

  async function save() {
    setSaving(true);
    await fetch("/api/admin/binds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    await load();
    setEditing(null);
    setSaving(false);
  }

  async function remove(slug: string) {
    if (!confirm(`Delete bind "${slug}"?`)) return;
    await fetch(`/api/admin/binds?slug=${encodeURIComponent(slug)}`, {
      method: "DELETE",
    });
    await load();
  }

  return (
    <div className="px-6 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <PageTitle>Activity Binds</PageTitle>
        <Button onClick={startCreate}>+ New bind</Button>
      </div>

      <p className="text-sm text-ey-light-gray mb-6">
        Each bind maps a slug used by the application (e.g.{" "}
        <code className="text-ey-yellow">doc-extraction</code>) to a model + prompt
        combination. Edit a bind to swap the model or prompt without code changes.
      </p>

      {editing && (
        <Card className="mb-6">
          <h3 className="text-ey-yellow font-semibold mb-4">
            {editing === "new" ? "New bind" : `Edit ${editing}`}
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
              label="Display name"
              name="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Document extraction"
              required
            />
            <Select
              label="Model"
              name="modelId"
              required
              value={form.modelId}
              onChange={(e) => setForm({ ...form, modelId: e.target.value })}
              options={models.map((m) => ({
                value: m.id,
                label: `${m.name} (${m.openrouterModelId})`,
              }))}
            />
            <Select
              label="Prompt"
              name="promptId"
              required
              value={form.promptId}
              onChange={(e) => setForm({ ...form, promptId: e.target.value })}
              options={prompts.map((p) => ({
                value: p.id,
                label: `${p.name} (${p.slug})`,
              }))}
            />
            <div className="flex gap-3 pt-2">
              <Button
                onClick={save}
                disabled={saving || !form.slug || !form.name || !form.modelId || !form.promptId}
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
        {binds.map((b) => (
          <Card key={b.slug}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-baseline gap-3">
                  <h3 className="text-white font-semibold">{b.name}</h3>
                  <code className="text-xs text-ey-yellow font-mono">{b.slug}</code>
                </div>
                <div className="text-sm text-ey-light-gray mt-2 space-y-1">
                  <div>
                    <span className="text-ey-sonic-silver">Model:</span>{" "}
                    {b.model.name}{" "}
                    <code className="text-xs text-ey-yellow font-mono">
                      {b.model.openrouterModelId}
                    </code>
                  </div>
                  <div>
                    <span className="text-ey-sonic-silver">Prompt:</span>{" "}
                    {b.prompt.name}{" "}
                    <code className="text-xs text-ey-yellow font-mono">{b.prompt.slug}</code>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => startEdit(b)}>
                  Edit
                </Button>
                <Button variant="danger" onClick={() => remove(b.slug)}>
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {binds.length === 0 && (
          <p className="text-sm text-ey-sonic-silver">No binds defined yet. Create one to wire up the LLM pipeline.</p>
        )}
      </div>
    </div>
  );
}
