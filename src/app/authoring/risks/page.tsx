"use client";

import { useCallback, useEffect, useState } from "react";
import { PageTitle, Card, Badge, Button, SectionTitle } from "@/components/ui";

// ── Types ────────────────────────────────────────────────────────────────────

interface RiskRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  displayOrder: number;
  _count: { questions: number };
}

interface RiskDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  displayOrder: number;
  questions: {
    questionId: string;
    slug: string;
    sectionSlug: string;
    sectionName: string;
    prompt: string;
    answerType: string;
  }[];
}

interface AvailableQuestion {
  id: string;
  slug: string;
  sectionSlug: string;
  sectionName: string;
  prompt: string;
}

const FOUNDATION_SECTIONS = new Set(["intake", "triage"]);

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AuthoringRisksPage() {
  const [risks, setRisks] = useState<RiskRow[]>([]);
  const [activeRiskId, setActiveRiskId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RiskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const refreshRisks = useCallback(async () => {
    const res = await fetch("/api/risks");
    if (!res.ok) return;
    const data = await res.json();
    setRisks(data);
  }, []);

  useEffect(() => {
    refreshRisks().finally(() => setLoading(false));
  }, [refreshRisks]);

  // Fetch detail when active risk changes
  useEffect(() => {
    if (!activeRiskId) {
      setDetail(null);
      return;
    }
    fetch(`/api/risks/${activeRiskId}`)
      .then((r) => r.ok ? r.json() : null)
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [activeRiskId]);

  async function handleDelete(riskId: string) {
    await fetch(`/api/risks/${riskId}`, { method: "DELETE" });
    setActiveRiskId(null);
    await refreshRisks();
  }

  async function handleRemoveQuestion(riskId: string, questionId: string) {
    await fetch(`/api/risks/${riskId}/questions/${questionId}`, { method: "DELETE" });
    // Refresh detail
    const res = await fetch(`/api/risks/${riskId}`);
    if (res.ok) setDetail(await res.json());
    await refreshRisks();
  }

  if (loading) return <div className="p-8 text-ey-sonic-silver">Loading...</div>;

  return (
    <div className="px-6 py-8 max-w-7xl">
      <div className="flex items-end justify-between mb-6">
        <PageTitle>Risks</PageTitle>
        <Button onClick={() => setShowCreate(true)}>New Risk</Button>
      </div>

      {showCreate && (
        <CreateRiskForm
          onCreated={async (id) => {
            setShowCreate(false);
            await refreshRisks();
            setActiveRiskId(id);
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      <div className="flex gap-6">
        {/* Risk rail */}
        <nav className="w-56 flex-shrink-0">
          <div className="sticky top-4 space-y-1">
            {risks.length === 0 && !showCreate && (
              <p className="text-xs text-ey-sonic-silver px-3 py-2">
                No risks defined yet. Click &ldquo;New Risk&rdquo; to create one.
              </p>
            )}
            {risks.map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveRiskId(r.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  r.id === activeRiskId
                    ? "bg-frame-red/10 text-frame-red border border-frame-red/30"
                    : "text-ey-light-gray hover:text-white hover:bg-ey-dark-gray"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{r.name}</span>
                  <span className="text-xs opacity-70">{r._count.questions}</span>
                </div>
              </button>
            ))}
          </div>
        </nav>

        {/* Detail */}
        <div className="flex-1 space-y-6">
          {detail && (
            <RiskDetailView
              detail={detail}
              onDelete={() => handleDelete(detail.id)}
              onRemoveQuestion={(qId) => handleRemoveQuestion(detail.id, qId)}
              onQuestionAdded={async () => {
                const res = await fetch(`/api/risks/${detail.id}`);
                if (res.ok) setDetail(await res.json());
                await refreshRisks();
              }}
            />
          )}
          {!detail && !showCreate && (
            <Card>
              <p className="text-ey-sonic-silver text-center py-8">
                Select a risk from the list or create a new one.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Create risk form ─────────────────────────────────────────────────────────

function CreateRiskForm({
  onCreated,
  onCancel,
}: {
  onCreated: (id: string) => void;
  onCancel: () => void;
}) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [displayOrder, setDisplayOrder] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/risks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, name, description: description || null, displayOrder }),
    });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "Failed to create risk");
      setSubmitting(false);
      return;
    }
    const risk = await res.json();
    onCreated(risk.id);
  }

  return (
    <Card className="mb-6">
      <SectionTitle>New Risk</SectionTitle>
      <form onSubmit={handleSubmit} className="space-y-4 mt-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-ey-light-gray mb-1">Slug</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="e.g., data-breach"
              required
              className="w-full px-3 py-2 rounded-lg bg-black border border-ey-sonic-silver/50 text-white placeholder:text-ey-sonic-silver text-sm focus:outline-none focus:border-ey-yellow/50"
            />
          </div>
          <div>
            <label className="block text-xs text-ey-light-gray mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Data Breach Exposure"
              required
              className="w-full px-3 py-2 rounded-lg bg-black border border-ey-sonic-silver/50 text-white placeholder:text-ey-sonic-silver text-sm focus:outline-none focus:border-ey-yellow/50"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-ey-light-gray mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this risk cover?"
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-black border border-ey-sonic-silver/50 text-white placeholder:text-ey-sonic-silver text-sm focus:outline-none focus:border-ey-yellow/50 resize-y"
          />
        </div>
        <div className="w-32">
          <label className="block text-xs text-ey-light-gray mb-1">Display Order</label>
          <input
            type="number"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg bg-black border border-ey-sonic-silver/50 text-white text-sm focus:outline-none focus:border-ey-yellow/50"
          />
        </div>
        {error && (
          <p className="text-frame-red text-sm">{error}</p>
        )}
        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create Risk"}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ── Risk detail view ─────────────────────────────────────────────────────────

function RiskDetailView({
  detail,
  onDelete,
  onRemoveQuestion,
  onQuestionAdded,
}: {
  detail: RiskDetail;
  onDelete: () => void;
  onRemoveQuestion: (questionId: string) => void;
  onQuestionAdded: () => void;
}) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <>
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-white text-lg font-semibold">{detail.name}</h2>
            <p className="text-ey-sonic-silver text-xs font-mono mt-1">{detail.slug}</p>
            {detail.description && (
              <p className="text-ey-light-gray text-sm mt-2">{detail.description}</p>
            )}
          </div>
          <Button variant="secondary" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle>Associated Questions ({detail.questions.length})</SectionTitle>
          <Button variant="secondary" onClick={() => setShowPicker((v) => !v)}>
            {showPicker ? "Close" : "Add Questions"}
          </Button>
        </div>

        {showPicker && (
          <QuestionPicker
            riskId={detail.id}
            existingQuestionIds={new Set(detail.questions.map((q) => q.questionId))}
            onAdded={onQuestionAdded}
          />
        )}

        <div className="space-y-2">
          {detail.questions.map((q) => (
            <Card key={q.questionId} className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm">{q.prompt}</p>
                <div className="flex gap-2 mt-1">
                  <span className="text-ey-sonic-silver text-xs font-mono">{q.slug}</span>
                  <Badge>{q.sectionName}</Badge>
                </div>
              </div>
              <button
                onClick={() => onRemoveQuestion(q.questionId)}
                className="text-xs text-frame-red hover:underline shrink-0"
              >
                Remove
              </button>
            </Card>
          ))}
          {detail.questions.length === 0 && (
            <Card>
              <p className="text-ey-sonic-silver text-center py-4">
                No questions assigned. Click &ldquo;Add Questions&rdquo; to associate questions with this risk.
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

// ── Question picker ──────────────────────────────────────────────────────────

function QuestionPicker({
  riskId,
  existingQuestionIds,
  onAdded,
}: {
  riskId: string;
  existingQuestionIds: Set<string>;
  onAdded: () => void;
}) {
  const [available, setAvailable] = useState<AvailableQuestion[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/corpus")
      .then((r) => r.json())
      .then((sections: { slug: string; displayName: string; questions: { id: string; slug: string; prompt: string }[] }[]) => {
        const qs: AvailableQuestion[] = [];
        for (const s of sections) {
          if (FOUNDATION_SECTIONS.has(s.slug)) continue;
          for (const q of s.questions) {
            if (!existingQuestionIds.has(q.id)) {
              qs.push({
                id: q.id,
                slug: q.slug,
                sectionSlug: s.slug,
                sectionName: s.displayName,
                prompt: q.prompt,
              });
            }
          }
        }
        setAvailable(qs);
      })
      .catch(() => setAvailable([]))
      .finally(() => setLoading(false));
  }, [existingQuestionIds]);

  const filtered = search.length >= 2
    ? available.filter(
        (q) =>
          q.slug.toLowerCase().includes(search.toLowerCase()) ||
          q.prompt.toLowerCase().includes(search.toLowerCase())
      )
    : available;

  async function addQuestion(questionId: string) {
    await fetch(`/api/risks/${riskId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId }),
    });
    setAvailable((prev) => prev.filter((q) => q.id !== questionId));
    onAdded();
  }

  return (
    <Card className="mb-4">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search available questions..."
        className="w-full px-3 py-2 rounded-lg bg-black border border-ey-sonic-silver/50 text-white placeholder:text-ey-sonic-silver text-sm focus:outline-none focus:border-ey-yellow/50 mb-3"
      />
      {loading ? (
        <p className="text-ey-sonic-silver text-xs">Loading questions...</p>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-1.5">
          {filtered.slice(0, 30).map((q) => (
            <div
              key={q.id}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded border border-ey-sonic-silver/20 hover:border-ey-yellow/30"
            >
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs truncate">{q.prompt}</p>
                <div className="flex gap-2 mt-0.5">
                  <span className="text-ey-sonic-silver text-[10px] font-mono">{q.slug}</span>
                  <span className="text-ey-sonic-silver text-[10px]">{q.sectionName}</span>
                </div>
              </div>
              <button
                onClick={() => addQuestion(q.id)}
                className="text-xs text-ey-yellow hover:underline shrink-0"
              >
                Add
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-ey-sonic-silver text-xs text-center py-2">
              {search.length >= 2 ? "No matching questions." : "All questions are already assigned."}
            </p>
          )}
          {filtered.length > 30 && (
            <p className="text-ey-sonic-silver text-[10px] text-center">
              Showing first 30 of {filtered.length} — narrow your search.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
