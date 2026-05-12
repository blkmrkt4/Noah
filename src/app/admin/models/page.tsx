"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Input, PageTitle } from "@/components/ui";

interface Model {
  id: string;
  openrouterModelId: string;
  name: string;
  description: string | null;
  temperature: number;
  maxTokens: number;
}

interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  pricing: { prompt: string; completion: string };
  architecture?: { modality?: string };
}

const empty = {
  openrouterModelId: "",
  name: "",
  description: "",
  temperature: "0.2",
  maxTokens: "4096",
};

function formatCost(cost: string): string {
  const n = parseFloat(cost);
  if (n === 0) return "free";
  const per1k = n * 1000;
  if (per1k < 0.001) return `$${(per1k * 1000).toFixed(2)}/M`;
  return `$${per1k.toFixed(4)}/1K`;
}

function volumeCost(perTokenCost: string, tokens: number): string {
  const cost = parseFloat(perTokenCost) * tokens;
  if (cost === 0) return "$0";
  if (cost < 1) return `$${cost.toFixed(2)}`;
  return `$${cost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function ModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  // OpenRouter model catalog for the picker
  const [orModels, setOrModels] = useState<OpenRouterModel[]>([]);
  const [orLoading, setOrLoading] = useState(false);
  const [orSearch, setOrSearch] = useState("");
  const [orOpen, setOrOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void load();
    void loadOrModels();
  }, []);

  async function load() {
    const res = await fetch("/api/admin/models");
    if (res.ok) setModels(await res.json());
  }

  async function loadOrModels() {
    if (orModels.length > 0) return; // already loaded
    setOrLoading(true);
    try {
      const res = await fetch("https://openrouter.ai/api/v1/models");
      const data = await res.json();
      const sorted = (data.data ?? [])
        .filter((m: OpenRouterModel) => m.id && m.name)
        .sort((a: OpenRouterModel, b: OpenRouterModel) => a.name.localeCompare(b.name));
      setOrModels(sorted);
    } catch {
      setOrModels([]);
    } finally {
      setOrLoading(false);
    }
  }

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOrOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredOrModels = useMemo(() => {
    if (!orSearch) return orModels.slice(0, 50);
    const q = orSearch.toLowerCase();
    return orModels.filter((m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)).slice(0, 50);
  }, [orModels, orSearch]);

  function selectOrModel(m: OpenRouterModel) {
    setForm({
      ...form,
      openrouterModelId: m.id,
      name: form.name || m.name,
      maxTokens: String(Math.min(m.context_length || 4096, 16384)),
    });
    setOrOpen(false);
    setOrSearch("");
  }

  const orLookup = useMemo(() => {
    const map = new Map<string, OpenRouterModel>();
    for (const m of orModels) map.set(m.id, m);
    return map;
  }, [orModels]);

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
            <div className="space-y-1">
              <label className="block text-sm font-medium text-ey-light-gray">
                OpenRouter model <span className="text-frame-red ml-1">*</span>
              </label>
              <div className="relative" ref={dropdownRef}>
                <div
                  className="w-full px-3 py-2 rounded-lg bg-black border border-ey-sonic-silver/50 text-white cursor-pointer flex items-center justify-between hover:border-ey-yellow/50 transition-colors"
                  onClick={() => { setOrOpen(!orOpen); if (!orOpen) loadOrModels(); }}
                >
                  <span className={form.openrouterModelId ? "text-white" : "text-ey-sonic-silver"}>
                    {form.openrouterModelId || "Select a model..."}
                  </span>
                  <span className="text-ey-sonic-silver text-xs">{orOpen ? "\u25B2" : "\u25BC"}</span>
                </div>
                {orOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-ey-dark-gray border border-ey-sonic-silver/50 rounded-lg shadow-xl max-h-80 overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-ey-sonic-silver/30">
                      <input
                        autoFocus
                        className="w-full px-3 py-2 rounded bg-black border border-ey-sonic-silver/50 text-white text-sm placeholder:text-ey-sonic-silver focus:outline-none focus:border-ey-yellow/50"
                        placeholder="Search models..."
                        value={orSearch}
                        onChange={(e) => setOrSearch(e.target.value)}
                      />
                    </div>
                    <div className="overflow-y-auto flex-1">
                      {orLoading ? (
                        <div className="px-3 py-4 text-sm text-ey-sonic-silver">Loading models from OpenRouter...</div>
                      ) : filteredOrModels.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-ey-sonic-silver">No models found.</div>
                      ) : (
                        filteredOrModels.map((m) => (
                          <div
                            key={m.id}
                            className={`px-3 py-2.5 cursor-pointer hover:bg-black/40 border-b border-ey-sonic-silver/10 ${m.id === form.openrouterModelId ? "bg-ey-yellow/10" : ""}`}
                            onClick={() => selectOrModel(m)}
                          >
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="text-white text-sm font-medium">{m.name}</div>
                              {(() => {
                                const inCost = parseFloat(m.pricing.prompt) * 100_000;
                                const outCost = parseFloat(m.pricing.completion) * 20_000;
                                const total = inCost + outCost;
                                const fmt = (n: number) => n === 0 ? "$0" : n < 0.01 ? `$${n.toFixed(4)}` : n < 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(2)}`;
                                return (
                                  <div className="text-ey-yellow text-sm font-semibold whitespace-nowrap">
                                    {fmt(total)}<span className="text-ey-sonic-silver font-normal text-xs">/call</span>
                                  </div>
                                );
                              })()}
                            </div>
                            <div className="text-ey-sonic-silver text-xs mt-0.5">
                              <code>{m.id}</code>
                              {m.context_length ? <span className="ml-3">{(m.context_length / 1000).toFixed(0)}K ctx</span> : null}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
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
        {models.map((m) => {
          const or = orLookup.get(m.openrouterModelId);
          return (
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
                  {or && (
                    <div className="mt-3 grid grid-cols-3 gap-x-6 gap-y-1 text-[10px]">
                      <div className="text-ey-sonic-silver font-medium uppercase tracking-wide">Volume</div>
                      <div className="text-ey-sonic-silver font-medium uppercase tracking-wide">Input</div>
                      <div className="text-ey-sonic-silver font-medium uppercase tracking-wide">Output</div>

                      <div className="text-ey-light-gray">10M tokens</div>
                      <div className="text-ey-yellow font-medium">{volumeCost(or.pricing.prompt, 10_000_000)}</div>
                      <div className="text-ey-yellow font-medium">{volumeCost(or.pricing.completion, 10_000_000)}</div>

                      <div className="text-ey-light-gray">100M tokens</div>
                      <div className="text-ey-yellow font-medium">{volumeCost(or.pricing.prompt, 100_000_000)}</div>
                      <div className="text-ey-yellow font-medium">{volumeCost(or.pricing.completion, 100_000_000)}</div>
                    </div>
                  )}
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
          );
        })}
        {models.length === 0 && (
          <p className="text-sm text-ey-sonic-silver">No models defined yet.</p>
        )}
      </div>
    </div>
  );
}
