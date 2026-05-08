"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, PageTitle } from "@/components/ui";
import { SlugReveal } from "@/components/SlugReveal";

interface SectionRow {
  slug: string;
  displayName: string;
  displayOrder: number;
}

const HIDDEN_SECTIONS = new Set(["intake", "triage"]);

interface Draft {
  id: string;
  body: string;
  status: "pending_review" | "approved" | "rejected";
  sourcePolicyDocId: string | null;
  sourcePolicyTitle: string | null;
  sourcePolicyVersion: number | null;
  sourcePolicyVersionId: string | null;
  isLatestPolicyVersion: boolean;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: { id: string; name: string; email: string } | null;
}

interface QuestionGroup {
  questionVersionId: string;
  questionId: string;
  questionSlug: string;
  questionPrompt: string;
  sectionSlug: string;
  sectionDisplayName: string;
  isLatestQuestionVersion: boolean;
  drafts: Draft[];
  published: Draft | null;
}

type Filter = "needs_review" | "all";

const FILTER_LABEL: Record<Filter, string> = {
  needs_review: "Needs review",
  all: "All questions",
};

export default function AuthoringScansPage() {
  const [groups, setGroups] = useState<QuestionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("needs_review");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [sections, setSections] = useState<SectionRow[]>([]);
  // null = "All sections"
  const [activeSectionSlug, setActiveSectionSlug] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/users")
      .then((r) => r.json())
      .then((users) => {
        if (Array.isArray(users) && users.length > 0) {
          setCurrentUserId(users[0].id);
          setCurrentUserName(users[0].name);
        }
      });
  }, []);

  useEffect(() => {
    void fetch("/api/sections")
      .then((r) => r.json())
      .then((list) => {
        if (!Array.isArray(list)) return;
        const rows: SectionRow[] = list
          .filter((s: { slug: string }) => !HIDDEN_SECTIONS.has(s.slug))
          .map((s: { slug: string; displayName: string; displayOrder: number }) => ({
            slug: s.slug,
            displayName: s.displayName,
            displayOrder: s.displayOrder,
          }));
        setSections(rows);
      });
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/more-info/by-question?include=${filter}`);
    const data = await res.json();
    setGroups(Array.isArray(data.questions) ? data.questions : []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Search + section filter, applied to the loaded groups.
  const visibleGroups = useMemo(() => {
    const s = search.trim().toLowerCase();
    return groups.filter((g) => {
      if (activeSectionSlug && g.sectionSlug !== activeSectionSlug) return false;
      if (!s) return true;
      return (
        g.questionSlug.toLowerCase().includes(s) ||
        g.questionPrompt.toLowerCase().includes(s) ||
        g.sectionDisplayName.toLowerCase().includes(s) ||
        g.drafts.some((d) =>
          (d.sourcePolicyTitle ?? "").toLowerCase().includes(s)
        )
      );
    });
  }, [groups, search, activeSectionSlug]);

  // Section badge counts respect search + the active status filter (groups
  // are already filtered by status from the server). A section's badge shows
  // how many questions in that section will appear under the current filter.
  const sectionGroupCounts = useMemo(() => {
    const s = search.trim().toLowerCase();
    const counts: Record<string, number> = { __all__: 0 };
    for (const g of groups) {
      const matchesSearch =
        !s ||
        g.questionSlug.toLowerCase().includes(s) ||
        g.questionPrompt.toLowerCase().includes(s) ||
        g.sectionDisplayName.toLowerCase().includes(s) ||
        g.drafts.some((d) => (d.sourcePolicyTitle ?? "").toLowerCase().includes(s));
      if (!matchesSearch) continue;
      counts.__all__++;
      counts[g.sectionSlug] = (counts[g.sectionSlug] ?? 0) + 1;
    }
    return counts;
  }, [groups, search]);

  useEffect(() => {
    if (visibleGroups.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !visibleGroups.some((g) => g.questionVersionId === selectedId)) {
      setSelectedId(visibleGroups[0].questionVersionId);
    }
  }, [visibleGroups, selectedId]);

  const selected = visibleGroups.find((g) => g.questionVersionId === selectedId) ?? null;

  const counts = useMemo(() => {
    let needsReview = 0;
    for (const g of groups) {
      const hasPending = g.drafts.some((d) => d.status === "pending_review");
      const isStale =
        !!g.published &&
        (!g.isLatestQuestionVersion ||
          (g.published.sourcePolicyVersionId !== null &&
            !g.published.isLatestPolicyVersion));
      if (hasPending || isStale) needsReview++;
    }
    return { needsReview };
  }, [groups]);

  async function publish(body: string, supersedeDraftIds: string[]) {
    if (!selected || !currentUserId) return;
    const res = await fetch("/api/more-info/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionVersionId: selected.questionVersionId,
        body,
        approvedById: currentUserId,
        supersedeDraftIds,
      }),
    });
    if (res.ok) await reload();
  }

  async function rejectDraft(draftId: string) {
    await fetch(`/api/more-info/${draftId}`, { method: "DELETE" });
    await reload();
  }

  async function saveDraftEdit(draftId: string, body: string) {
    await fetch(`/api/more-info/${draftId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    await reload();
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="px-6 py-4 border-b border-ey-dark-gray flex items-center justify-between gap-4">
        <div>
          <PageTitle>Guidance editor</PageTitle>
          <p className="text-xs text-ey-sonic-silver mt-1">
            Per question, the AI extracts a draft from each bound policy. Read
            the drafts, then compose a single guidance — that&apos;s what
            owners see under the{" "}
            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-ey-sonic-silver text-[9px] font-bold">
              i
            </span>{" "}
            button. Aim for two sections in the body:{" "}
            <code className="text-ey-light-gray">## Description</code> and
            optionally{" "}
            <code className="text-ey-light-gray">## Example</code>.
          </p>
        </div>
        <p className="text-xs text-ey-sonic-silver shrink-0">
          Acting as <span className="text-ey-light-gray">{currentUserName ?? "—"}</span>
        </p>
      </header>

      <div className="flex flex-1 min-h-0">
        <SectionRail
          sections={sections}
          activeSectionSlug={activeSectionSlug}
          onPick={setActiveSectionSlug}
          counts={sectionGroupCounts}
        />

        <QuestionList
          groups={visibleGroups}
          loading={loading}
          filter={filter}
          counts={counts}
          search={search}
          onSearch={setSearch}
          onFilter={setFilter}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />

        <main className="flex-1 min-w-0 overflow-y-auto">
          {selected ? (
            <QuestionEditor
              key={selected.questionVersionId}
              group={selected}
              onPublish={publish}
              onRejectDraft={rejectDraft}
              onSaveDraftEdit={saveDraftEdit}
            />
          ) : (
            <div className="px-6 py-6 max-w-5xl">
              <p className="text-ey-sonic-silver text-sm">
                {loading
                  ? "Loading…"
                  : filter === "needs_review"
                    ? "No questions are waiting for guidance review."
                    : "Nothing to show with the current filter."}
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function SectionRail({
  sections,
  activeSectionSlug,
  onPick,
  counts,
}: {
  sections: SectionRow[];
  activeSectionSlug: string | null;
  onPick: (slug: string | null) => void;
  counts: Record<string, number>;
}) {
  return (
    <aside className="w-60 shrink-0 border-r border-ey-dark-gray bg-ey-black overflow-y-auto">
      <div className="px-4 py-4 border-b border-ey-dark-gray">
        <p className="text-[10px] uppercase tracking-wider text-ey-sonic-silver">
          Sections
        </p>
      </div>
      <nav>
        <SectionRailButton
          label="All sections"
          isActive={activeSectionSlug === null}
          count={counts.__all__ ?? 0}
          onClick={() => onPick(null)}
        />
        {sections.map((s) => (
          <SectionRailButton
            key={s.slug}
            label={s.displayName}
            isActive={s.slug === activeSectionSlug}
            count={counts[s.slug] ?? 0}
            onClick={() => onPick(s.slug)}
          />
        ))}
      </nav>
    </aside>
  );
}

function SectionRailButton({
  label,
  isActive,
  count,
  onClick,
}: {
  label: string;
  isActive: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-l-2 flex items-center justify-between ${
        isActive
          ? "bg-ey-dark-gray text-ey-yellow border-ey-yellow"
          : "text-ey-light-gray hover:bg-ey-dark-gray hover:text-ey-yellow border-transparent"
      }`}
    >
      <span className="truncate">{label}</span>
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
          count === 0
            ? "text-ey-sonic-silver"
            : isActive
              ? "bg-ey-yellow/20 text-ey-yellow"
              : "bg-ey-dark-gray text-ey-light-gray"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function QuestionList({
  groups,
  loading,
  filter,
  counts,
  search,
  onSearch,
  onFilter,
  selectedId,
  onSelect,
}: {
  groups: QuestionGroup[];
  loading: boolean;
  filter: Filter;
  counts: { needsReview: number };
  search: string;
  onSearch: (s: string) => void;
  onFilter: (f: Filter) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="w-80 shrink-0 border-r border-ey-dark-gray bg-ey-black flex flex-col">
      <div className="p-3 border-b border-ey-dark-gray space-y-2">
        <div className="flex gap-1">
          <FilterTab
            active={filter === "needs_review"}
            label={`${FILTER_LABEL.needs_review} (${counts.needsReview})`}
            onClick={() => onFilter("needs_review")}
          />
          <FilterTab
            active={filter === "all"}
            label={FILTER_LABEL.all}
            onClick={() => onFilter("all")}
          />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search by slug, prompt, or policy…"
          className="w-full px-2 py-1.5 rounded bg-black border border-ey-sonic-silver/40 text-white text-xs placeholder:text-ey-sonic-silver focus:outline-none focus:border-ey-yellow/50"
        />
      </div>

      <ul className="flex-1 overflow-y-auto">
        {loading ? (
          <li className="px-4 py-3 text-xs text-ey-sonic-silver">Loading…</li>
        ) : groups.length === 0 ? (
          <li className="px-4 py-3 text-xs text-ey-sonic-silver">Nothing here.</li>
        ) : (
          groups.map((g) => (
            <QuestionListRow
              key={g.questionVersionId}
              group={g}
              active={g.questionVersionId === selectedId}
              onClick={() => onSelect(g.questionVersionId)}
            />
          ))
        )}
      </ul>
    </aside>
  );
}

function FilterTab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
        active
          ? "bg-ey-yellow text-black"
          : "bg-ey-dark-gray text-ey-light-gray border border-ey-sonic-silver/30 hover:border-ey-yellow/50"
      }`}
    >
      {label}
    </button>
  );
}

function QuestionListRow({
  group,
  active,
  onClick,
}: {
  group: QuestionGroup;
  active: boolean;
  onClick: () => void;
}) {
  const tag = ((): {
    color: "yellow" | "green" | "orange" | "default";
    label: string;
    tooltip?: string;
  } | null => {
    if (!group.isLatestQuestionVersion && group.published)
      return {
        color: "orange",
        label: "Question stale",
        tooltip: "The question text changed since this guidance was published.",
      };
    if (
      group.published &&
      group.published.sourcePolicyVersionId !== null &&
      !group.published.isLatestPolicyVersion
    )
      return {
        color: "orange",
        label: "Policy stale",
        tooltip: "The source policy has a newer version since this guidance was published.",
      };
    if (group.published) return { color: "green", label: "Final" };
    if (group.drafts.length === 0)
      return { color: "default", label: "No guidance" };
    // Untouched AI drafts are the default post-scan state — no badge, since
    // their presence is implied by being in the Needs Review tab.
    return null;
  })();

  return (
    <li>
      <button
        onClick={onClick}
        className={`w-full text-left px-3 py-2.5 border-b border-ey-dark-gray transition-colors ${
          active ? "bg-ey-yellow/5 border-l-2 border-l-ey-yellow" : "hover:bg-ey-dark-gray"
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-1 min-h-[18px]">
          {tag ? (
            <span title={tag.tooltip ?? tag.label}>
              <Badge color={tag.color}>{tag.label}</Badge>
            </span>
          ) : (
            <span />
          )}
          <span className="text-[10px] text-ey-sonic-silver shrink-0">
            {group.sectionDisplayName}
          </span>
        </div>
        <SlugReveal slug={group.questionSlug} />
        <p className="text-xs text-ey-light-gray mt-0.5 line-clamp-2 leading-snug">
          {group.questionPrompt}
        </p>
      </button>
    </li>
  );
}

function QuestionEditor({
  group,
  onPublish,
  onRejectDraft,
  onSaveDraftEdit,
}: {
  group: QuestionGroup;
  onPublish: (body: string, supersedeDraftIds: string[]) => void;
  onRejectDraft: (draftId: string) => void;
  onSaveDraftEdit: (draftId: string, body: string) => void;
}) {
  const pendingDrafts = group.drafts.filter((d) => d.status === "pending_review");
  const initialPublished = group.published?.body ?? "";
  const seedFromDraft = pendingDrafts[0]?.body ?? "";

  const [body, setBody] = useState(initialPublished || seedFromDraft);
  const [submitting, setSubmitting] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(
    pendingDrafts[0]?.id ?? null
  );

  function insertDraftAsBody(draftBody: string) {
    setBody(draftBody);
  }
  function appendDraftToBody(draftBody: string) {
    setBody((prev) => (prev.trim() ? `${prev.trim()}\n\n${draftBody}` : draftBody));
  }

  async function publish() {
    setSubmitting(true);
    await onPublish(body, pendingDrafts.map((d) => d.id));
    setSubmitting(false);
  }

  const dirty = body.trim() !== initialPublished.trim();

  return (
    <article className="px-6 py-6 max-w-5xl space-y-5">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-ey-sonic-silver mb-1">
          Question · {group.sectionDisplayName}
        </p>
        <p className="text-white text-sm font-medium leading-snug">
          {group.questionPrompt}
        </p>
        <div className="mt-1">
          <SlugReveal slug={group.questionSlug} />
        </div>
        {!group.isLatestQuestionVersion && (
          <p className="text-[11px] text-frame-orange mt-2">
            The question text has changed since the existing guidance was
            published. Re-publish after reviewing the latest drafts.
          </p>
        )}
      </div>

      {/* Drafts panel */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <p className="text-[10px] uppercase tracking-wider text-ey-sonic-silver">
            Drafts from policies ({pendingDrafts.length} pending)
          </p>
          <p className="text-[11px] text-ey-sonic-silver">
            Click a draft to focus it. Use{" "}
            <span className="text-ey-light-gray">Use as guidance</span> or{" "}
            <span className="text-ey-light-gray">Append to guidance</span> to
            pull its content into the published box.
          </p>
        </div>
        {pendingDrafts.length === 0 ? (
          <p className="text-xs text-ey-sonic-silver italic px-3 py-2 border border-dashed border-ey-sonic-silver/30 rounded">
            No pending drafts. Run a scan from{" "}
            <a href="/authoring/policies" className="text-ey-yellow hover:underline">
              Authoring → Policies
            </a>{" "}
            to generate fresh extractions.
          </p>
        ) : (
          <ul className="space-y-2">
            {pendingDrafts.map((d) => (
              <DraftCard
                key={d.id}
                draft={d}
                active={activeDraftId === d.id}
                onClick={() => setActiveDraftId(d.id)}
                onUseAs={() => insertDraftAsBody(d.body)}
                onAppend={() => appendDraftToBody(d.body)}
                onReject={() => onRejectDraft(d.id)}
                onSaveEdit={(newBody) => onSaveDraftEdit(d.id, newBody)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Published / composition box */}
      <section className="space-y-2 pt-3 border-t border-ey-dark-gray">
        <div className="flex items-baseline justify-between">
          <p className="text-[10px] uppercase tracking-wider text-ey-sonic-silver">
            Guidance — what owners will see
          </p>
          {group.published && (
            <p className="text-[11px] text-ey-sonic-silver">
              Last published{" "}
              {group.published.approvedAt
                ? new Date(group.published.approvedAt).toLocaleString()
                : "—"}
              {group.published.approvedBy && ` · by ${group.published.approvedBy.name}`}
            </p>
          )}
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          placeholder={`Compose what the Commercial Owner will read. Aim for two sections:

## Description
A concise distillation of what this policy means for this question — clearer than the source, focused on what the owner needs to know.

## Example
A practical example of how another product applied this and why it matters. Optional but recommended for any non-obvious question.`}
          className="w-full px-3 py-2 rounded bg-black border border-ey-sonic-silver/40 text-white text-sm placeholder:text-ey-sonic-silver focus:outline-none focus:border-ey-yellow/50 leading-relaxed"
        />

        <div className="flex items-center justify-end gap-2">
          <Button onClick={publish} disabled={submitting || !body.trim() || (!dirty && pendingDrafts.length === 0)}>
            {submitting
              ? "Publishing…"
              : group.published
                ? pendingDrafts.length > 0
                  ? `Publish & retire ${pendingDrafts.length} draft${pendingDrafts.length === 1 ? "" : "s"}`
                  : "Re-publish"
                : pendingDrafts.length > 0
                  ? `Publish & retire ${pendingDrafts.length} draft${pendingDrafts.length === 1 ? "" : "s"}`
                  : "Publish"}
          </Button>
        </div>
      </section>
    </article>
  );
}

function DraftCard({
  draft,
  active,
  onClick,
  onUseAs,
  onAppend,
  onReject,
  onSaveEdit,
}: {
  draft: Draft;
  active: boolean;
  onClick: () => void;
  onUseAs: () => void;
  onAppend: () => void;
  onReject: () => void;
  onSaveEdit: (body: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(draft.body);

  return (
    <li
      onClick={onClick}
      className={`rounded border transition-colors cursor-pointer ${
        active
          ? "border-ey-yellow/60 bg-ey-yellow/5"
          : "border-ey-sonic-silver/30 hover:border-ey-yellow/30"
      }`}
    >
      <div className="px-3 py-2 border-b border-ey-sonic-silver/20 flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2">
          <Badge color="default">
            {draft.sourcePolicyTitle ?? "(no source)"}
            {draft.sourcePolicyVersion !== null && ` · v${draft.sourcePolicyVersion}`}
          </Badge>
          {!draft.isLatestPolicyVersion && (
            <Badge color="orange">policy outdated</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!editing ? (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUseAs();
                }}
                className="text-[11px] text-ey-yellow hover:underline"
              >
                Use as guidance
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAppend();
                }}
                className="text-[11px] text-ey-light-gray hover:text-white"
              >
                Append
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(true);
                }}
                className="text-[11px] text-ey-light-gray hover:text-white"
              >
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("Reject this draft? It stays in the audit trail."))
                    onReject();
                }}
                className="text-[11px] text-frame-red hover:underline"
              >
                Reject
              </button>
            </>
          ) : (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setBody(draft.body);
                  setEditing(false);
                }}
                className="text-[11px] text-ey-sonic-silver hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSaveEdit(body);
                  setEditing(false);
                }}
                className="text-[11px] text-ey-yellow hover:underline"
              >
                Save edit
              </button>
            </>
          )}
        </div>
      </div>
      <div className="px-3 py-2.5">
        {editing ? (
          <textarea
            onClick={(e) => e.stopPropagation()}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            className="w-full px-2 py-1.5 rounded bg-black border border-ey-sonic-silver/40 text-white text-xs focus:outline-none focus:border-ey-yellow/50 leading-relaxed"
          />
        ) : (
          <p className="text-xs text-ey-light-gray whitespace-pre-wrap leading-relaxed">
            {draft.body}
          </p>
        )}
      </div>
    </li>
  );
}
