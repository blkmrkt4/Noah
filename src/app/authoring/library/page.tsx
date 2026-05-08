"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, PageTitle } from "@/components/ui";
import { SlugReveal } from "@/components/SlugReveal";

interface Snippet {
  id: string;
  body: string;
  rawStatus: "approved" | "pending_review" | "rejected";
  derivedStatus: "fresh" | "question_stale" | "policy_stale" | "pending_review" | "rejected";
  questionSlug: string;
  questionPrompt: string;
  sectionSlug: string;
  sectionDisplayName: string;
  sourcePolicyTitle: string | null;
  approvedBy: { id: string; name: string; email: string } | null;
  approvedAt: string | null;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  fresh: "Fresh",
  question_stale: "Question-stale",
  policy_stale: "Policy-stale",
  pending_review: "Pending review",
  rejected: "Rejected",
};

const STATUS_BADGE: Record<string, "default" | "green" | "orange" | "yellow" | "red"> = {
  fresh: "green",
  question_stale: "orange",
  policy_stale: "orange",
  pending_review: "yellow",
  rejected: "red",
};

export default function AuthoringLibraryPage() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/users")
      .then((r) => r.json())
      .then((users) => {
        if (Array.isArray(users) && users.length > 0) setCurrentUserId(users[0].id);
      });
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/more-info");
    const data = await res.json();
    setSnippets(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  const sections = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of snippets) {
      if (!map.has(s.sectionSlug)) map.set(s.sectionSlug, s.sectionDisplayName);
    }
    return [...map.entries()].sort();
  }, [snippets]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of snippets) {
      counts[s.derivedStatus] = (counts[s.derivedStatus] ?? 0) + 1;
    }
    return counts;
  }, [snippets]);

  const filtered = useMemo(() => {
    return snippets.filter((s) => {
      if (statusFilter !== "all" && s.derivedStatus !== statusFilter) return false;
      if (sectionFilter !== "all" && s.sectionSlug !== sectionFilter) return false;
      return true;
    });
  }, [snippets, statusFilter, sectionFilter]);

  async function saveEdit(id: string, body: string) {
    await fetch(`/api/more-info/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setEditingId(null);
    await load();
  }

  async function approve(id: string, body: string) {
    if (!currentUserId) return;
    await fetch(`/api/more-info/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, approve: true, approvedById: currentUserId }),
    });
    setEditingId(null);
    await load();
  }

  return (
    <div className="px-6 py-8 max-w-5xl space-y-6">
      <PageTitle>Guidance library</PageTitle>
      <p className="text-sm text-ey-light-gray">
        Every guidance draft and published guidance that has ever existed.
        Browse by section or status, edit inline. The day-to-day workflow
        lives in{" "}
        <a href="/authoring/scans" className="text-ey-yellow hover:underline">
          Guidance editor
        </a>
        ; this page is for audit and bulk review.
      </p>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          onClick={() => setStatusFilter("all")}
          className={`px-3 py-1 rounded-full border transition-colors ${
            statusFilter === "all"
              ? "border-ey-yellow text-ey-yellow"
              : "border-ey-sonic-silver/40 text-ey-light-gray hover:border-ey-yellow/40"
          }`}
        >
          All ({snippets.length})
        </button>
        {(["fresh", "policy_stale", "question_stale", "pending_review", "rejected"] as const).map(
          (s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full border transition-colors ${
                statusFilter === s
                  ? "border-ey-yellow text-ey-yellow"
                  : "border-ey-sonic-silver/40 text-ey-light-gray hover:border-ey-yellow/40"
              }`}
            >
              {STATUS_LABEL[s]} ({statusCounts[s] ?? 0})
            </button>
          )
        )}
      </div>

      {/* Section filter */}
      {sections.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-[10px] uppercase tracking-wider text-ey-sonic-silver">
            Section
          </label>
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="px-3 py-1.5 rounded bg-black border border-ey-sonic-silver/40 text-white text-xs"
          >
            <option value="all">All sections</option>
            {sections.map(([slug, name]) => (
              <option key={slug} value={slug}>
                {name}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <Card>
          <p className="text-ey-sonic-silver text-sm">Loading library...</p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <p className="text-ey-sonic-silver text-sm">
            No guidance entries match the current filters.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <SnippetRow
              key={s.id}
              snippet={s}
              editing={editingId === s.id}
              onEdit={() => setEditingId(s.id)}
              onCancel={() => setEditingId(null)}
              onSave={(body) => saveEdit(s.id, body)}
              onApprove={(body) => approve(s.id, body)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SnippetRow({
  snippet,
  editing,
  onEdit,
  onCancel,
  onSave,
  onApprove,
}: {
  snippet: Snippet;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (body: string) => void;
  onApprove: (body: string) => void;
}) {
  const [body, setBody] = useState(snippet.body);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setBody(snippet.body);
  }, [snippet.body, editing]);

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge color={STATUS_BADGE[snippet.derivedStatus] ?? "default"}>
              {STATUS_LABEL[snippet.derivedStatus] ?? snippet.derivedStatus}
            </Badge>
            <span className="text-[11px] text-ey-sonic-silver">
              {snippet.sectionDisplayName}
            </span>
          </div>
          <p className="text-xs text-white">{snippet.questionPrompt}</p>
          <SlugReveal slug={snippet.questionSlug} />
        </div>
        {!editing && (
          <button
            onClick={onEdit}
            className="text-xs text-ey-sonic-silver hover:text-white shrink-0"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 rounded bg-black border border-ey-sonic-silver/40 text-white text-xs focus:outline-none focus:border-ey-yellow/50"
          />
          <div className="flex justify-between items-center">
            <p className="text-[11px] text-ey-sonic-silver">
              {snippet.sourcePolicyTitle && `Source: ${snippet.sourcePolicyTitle}`}
            </p>
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                disabled={submitting}
                className="text-xs text-ey-sonic-silver hover:text-white"
              >
                Cancel
              </button>
              {snippet.rawStatus === "pending_review" ? (
                <Button
                  onClick={async () => {
                    setSubmitting(true);
                    await onApprove(body);
                    setSubmitting(false);
                  }}
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : "Approve"}
                </Button>
              ) : (
                <Button
                  onClick={async () => {
                    setSubmitting(true);
                    await onSave(body);
                    setSubmitting(false);
                  }}
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : "Save"}
                </Button>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-ey-light-gray whitespace-pre-wrap">{snippet.body}</p>
          <div className="flex items-center justify-between text-[11px] text-ey-sonic-silver">
            <span>{snippet.sourcePolicyTitle && `Source: ${snippet.sourcePolicyTitle}`}</span>
            {snippet.approvedBy && snippet.approvedAt && (
              <span>
                Approved by {snippet.approvedBy.name} ·{" "}
                {new Date(snippet.approvedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
