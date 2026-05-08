"use client";

import { useEffect, useState } from "react";
import { Button, Card, Input, PageTitle } from "@/components/ui";

interface Model {
  id: string;
  openrouterModelId: string;
  name: string;
  description: string | null;
  temperature: number;
  maxTokens: number;
}

const empty = {
  openrouterModelId: "",
  name: "",
  description: "",
  temperature: "0.2",
  maxTokens: "4096",
};

export default function ModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const res = await fetch("/api/admin/models");
    setModels(await res.json());
  }

  function startCreate() {
    setEditing("new");
    setForm(empty);
  }

  function startEdit(m: Model) {
    setEditing(m.id);
    setForm({
      openrouterModelId: m.openrouterModelId,
      name: m.name,
      description: m.description ?? "",
      temperature: String(m.temperature),
      maxTokens: String(m.maxTokens),
    });
  }

  async function save() {
    setSaving(true);
    const payload = {
      openrouterModelId: form.openrouterModelId.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      temperature: parseFloat(form.temperature),
      maxTokens: parseInt(form.maxTokens, 10),
    };
    const url = editing === "new" ? "/api/admin/models" : `/api/admin/models/${editing}`;
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
    if (!confirm("Delete this model?")) return;
    const res = await fetch(`/api/admin/models/${id}`, { method: "DELETE" });
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
        <PageTitle>Models</PageTitle>
        <Button onClick={startCreate}>+ New model</Button>
      </div>

      <p className="text-sm text-ey-light-gray mb-6">
        Models you can route LLM calls to via OpenRouter. The OpenRouter model ID
        (e.g. <code className="text-ey-yellow">anthropic/claude-sonnet-4</code>) is the canonical reference.
      </p>

      {editing && (
        <Card className="mb-6">
          <h3 className="text-ey-yellow font-semibold mb-4">
            {editing === "new" ? "New model" : "Edit model"}
          </h3>
          <div className="space-y-3">
            <Input
              label="OpenRouter model ID"
              name="openrouterModelId"
              value={form.openrouterModelId}
              onChange={(e) => setForm({ ...form, openrouterModelId: e.target.value })}
              placeholder="anthropic/claude-sonnet-4"
              required
            />
            <Input
              label="Display name"
              name="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Sonnet 4 (heavy)"
              required
            />
            <Input
              label="Description"
              name="description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Best for complex reasoning"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Temperature"
                name="temperature"
                value={form.temperature}
                onChange={(e) => setForm({ ...form, temperature: e.target.value })}
              />
              <Input
                label="Max tokens"
                name="maxTokens"
                value={form.maxTokens}
                onChange={(e) => setForm({ ...form, maxTokens: e.target.value })}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={save} disabled={saving || !form.openrouterModelId || !form.name}>
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
        {models.map((m) => (
          <Card key={m.id}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-baseline gap-3">
                  <h3 className="text-white font-semibold">{m.name}</h3>
                  <code className="text-xs text-ey-yellow font-mono">{m.openrouterModelId}</code>
                </div>
                {m.description && (
                  <p className="text-sm text-ey-light-gray mt-1">{m.description}</p>
                )}
                <div className="text-xs text-ey-sonic-silver mt-2">
                  temperature {m.temperature} · max_tokens {m.maxTokens}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => startEdit(m)}>
                  Edit
                </Button>
                <Button variant="danger" onClick={() => remove(m.id)}>
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {models.length === 0 && (
          <p className="text-sm text-ey-sonic-silver">No models defined yet.</p>
        )}
      </div>
    </div>
  );
}
