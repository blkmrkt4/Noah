"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Input } from "@/components/ui";
import {
  JurisdictionPicker,
  summarizeScope,
  type JurisdictionScope,
} from "@/components/JurisdictionPicker";

const ACCEPT = ".pdf,.docx,.xlsx,.csv,.txt,.md";

const SCAN_STATUS_BADGE: Record<
  "not_scanned" | "scanned" | "stale",
  { color: "default" | "green" | "orange"; label: string }
> = {
  not_scanned: { color: "default", label: "Not scanned" },
  scanned: { color: "green", label: "Scanned" },
  stale: { color: "orange", label: "Stale" },
};

interface SectionRow {
  id: string;
  slug: string;
  displayName: string;
  displayOrder: number;
  policyCount: number;
  questionCount: number;
}

interface PolicyVersionSummary {
  id: string;
  version: number;
  effectiveAt: string;
  filename: string | null;
  fileFormat: string | null;
  mimeType: string | null;
  uploadedAt: string;
}

interface OtherSection {
  slug: string;
  displayName: string;
}

interface SectionPolicy {
  id: string;
  title: string;
  description: string | null;
  jurisdictionScope: JurisdictionScope | null;
  latest: PolicyVersionSummary | null;
  versions: PolicyVersionSummary[];
  isPrimary: boolean;
  otherSections: OtherSection[];
  excludedQuestionVersionIds: string[];
  scanStatus: "not_scanned" | "scanned" | "stale";
}

interface SectionQuestion {
  questionId: string;
  slug: string;
  questionVersionId: string;
  version: number;
  prompt: string;
  excludedPolicyIds: string[];
}

interface SectionPayload {
  section: { id: string; slug: string; displayName: string };
  policies: SectionPolicy[];
  questions: SectionQuestion[];
}

// Sections that aren't policy-bearing (intake/triage are foundational, not
// reviewable domains). Hidden from the policies rail.
const HIDDEN_SECTIONS = new Set(["intake", "triage"]);

export default function AuthoringPoliciesPage() {
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [data, setData] = useState<SectionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedPolicyId, setExpandedPolicyId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState<{ replace?: SectionPolicy } | null>(null);

  const refreshSections = useCallback(async () => {
    const res = await fetch("/api/sections");
    if (!res.ok) return;
    const list = await res.json();
    if (!Array.isArray(list)) return;
    const rows: SectionRow[] = list
      .filter((s: { slug: string }) => !HIDDEN_SECTIONS.has(s.slug))
      .map((s: {
        id: string;
        slug: string;
        displayName: string;
        displayOrder: number;
        policyBindings: unknown[];
        _count: { questions: number };
      }) => ({
        id: s.id,
        slug: s.slug,
        displayName: s.displayName,
        displayOrder: s.displayOrder,
        policyCount: s.policyBindings.length,
        questionCount: s._count.questions,
      }));
    setSections(rows);
    if (!activeSlug && rows.length > 0) setActiveSlug(rows[0].slug);
  }, [activeSlug]);

  const reload = useCallback(async () => {
    if (!activeSlug) return;
    setLoading(true);
    const res = await fetch(`/api/policies/section/${activeSlug}`);
    const payload: SectionPayload = await res.json();
    setData(payload);
    setLoading(false);
  }, [activeSlug]);

  useEffect(() => {
    void refreshSections();
  }, [refreshSections]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function deletePolicy(policyId: string) {
    if (!confirm("Delete this policy and all its versions? Cannot be undone."))
      return;
    const res = await fetch(`/api/policies/${policyId}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Delete failed");
      return;
    }
    await Promise.all([reload(), refreshSections()]);
  }

  async function unbindFromSection(policyId: string) {
    if (!activeSlug) return;
    if (
      !confirm(
        `Remove this policy from ${activeSlug}? It stays in any other sections it's bound to.`
      )
    )
      return;
    const res = await fetch(
      `/api/policies/${policyId}/sections/${activeSlug}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Unbind failed");
      return;
    }
    await Promise.all([reload(), refreshSections()]);
  }

  async function updatePolicyMeta(
    policyId: string,
    fields: { description?: string | null; jurisdictionScope?: JurisdictionScope }
  ) {
    const res = await fetch(`/api/policies/${policyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (res.ok) await reload();
  }

  const activeSection = sections.find((s) => s.slug === activeSlug) ?? null;

  return (
    <div className="flex h-full min-h-0">
      <Rail
        sections={sections}
        activeSlug={activeSlug}
        onPick={(slug) => {
          setActiveSlug(slug);
          setExpandedPolicyId(null);
        }}
      />

      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="px-6 py-6 max-w-5xl">
          <div className="flex items-baseline justify-between gap-4 mb-2">
            <h1 className="font-bold leading-tight">
              <span className="text-ey-yellow text-3xl">Policy Library</span>
              <span className="text-white text-2xl ml-2">
                — {activeSection?.displayName ?? "—"}
              </span>
            </h1>
            <Button
              onClick={() => setShowUpload({})}
              disabled={loading || !activeSection}
            >
              + Add policy
            </Button>
          </div>

          <p className="text-sm text-ey-light-gray mb-6">
            Add a policy and it&apos;s automatically the source for every question
            in this section. Tune the scope and run scans from{" "}
            <a href="/authoring/questions" className="text-ey-yellow hover:underline">
              Questions
            </a>
            .
          </p>

          {loading || !data ? (
            <p className="text-sm text-ey-sonic-silver">Loading…</p>
          ) : data.policies.length === 0 ? (
            <p className="text-sm text-ey-sonic-silver">
              No policies in this section yet —{" "}
              <button
                onClick={() => setShowUpload({})}
                className="text-ey-yellow hover:underline"
              >
                add the first one
              </button>
              . Until you do, questions in this section have no scan source.
            </p>
          ) : (
            <ul className="space-y-3">
              {data.policies.map((p) => (
                <PolicyDetail
                  key={p.id}
                  policy={p}
                  questions={data.questions}
                  expanded={expandedPolicyId === p.id}
                  onToggle={() =>
                    setExpandedPolicyId((cur) => (cur === p.id ? null : p.id))
                  }
                  onReplace={() => setShowUpload({ replace: p })}
                  onDelete={() => deletePolicy(p.id)}
                  onUnbind={() => unbindFromSection(p.id)}
                  onMetaChange={(fields) => updatePolicyMeta(p.id, fields)}
                />
              ))}
            </ul>
          )}
        </div>
      </main>

      {showUpload && activeSection && (
        <UploadModal
          sectionSlug={activeSection.slug}
          sectionLabel={activeSection.displayName}
          replaceTarget={showUpload.replace ?? null}
          onClose={() => setShowUpload(null)}
          onUploaded={async () => {
            setShowUpload(null);
            await Promise.all([reload(), refreshSections()]);
          }}
        />
      )}
    </div>
  );
}

function Rail({
  sections,
  activeSlug,
  onPick,
}: {
  sections: SectionRow[];
  activeSlug: string | null;
  onPick: (slug: string) => void;
}) {
  return (
    <aside className="w-60 shrink-0 border-r border-ey-dark-gray bg-ey-black overflow-y-auto">
      <div className="px-4 py-4 border-b border-ey-dark-gray">
        <p className="text-[10px] uppercase tracking-wider text-ey-sonic-silver">
          Sections
        </p>
      </div>
      <nav>
        {sections.map((s) => {
          const isActive = s.slug === activeSlug;
          return (
            <button
              key={s.slug}
              onClick={() => onPick(s.slug)}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-l-2 flex items-center justify-between ${
                isActive
                  ? "bg-ey-dark-gray text-ey-yellow border-ey-yellow"
                  : "text-ey-light-gray hover:bg-ey-dark-gray hover:text-ey-yellow border-transparent"
              }`}
            >
              <span className="truncate">{s.displayName}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  s.policyCount === 0
                    ? "text-ey-sonic-silver"
                    : isActive
                      ? "bg-ey-yellow/20 text-ey-yellow"
                      : "bg-ey-dark-gray text-ey-light-gray"
                }`}
              >
                {s.policyCount}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function PolicyDetail({
  policy,
  questions,
  expanded,
  onToggle,
  onReplace,
  onDelete,
  onUnbind,
  onMetaChange,
}: {
  policy: SectionPolicy;
  questions: SectionQuestion[];
  expanded: boolean;
  onToggle: () => void;
  onReplace: () => void;
  onDelete: () => void;
  onUnbind: () => void;
  onMetaChange: (fields: {
    description?: string | null;
    jurisdictionScope?: JurisdictionScope;
  }) => void;
}) {
  const status = SCAN_STATUS_BADGE[policy.scanStatus];
  const scope = (policy.jurisdictionScope as JurisdictionScope) ?? null;
  const excluded = useMemo(
    () => new Set(policy.excludedQuestionVersionIds),
    [policy.excludedQuestionVersionIds]
  );
  const eligibleCount = questions.filter(
    (q) => !excluded.has(q.questionVersionId)
  ).length;

  return (
    <li className="border border-ey-sonic-silver/30 rounded-lg overflow-hidden bg-ey-dark-gray">
      <div className="flex items-stretch">
        <button
          onClick={onToggle}
          className="flex-1 min-w-0 text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-black/30 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Badge color={status.color}>{status.label}</Badge>
            <span className="text-white font-medium truncate">{policy.title}</span>
            {policy.latest?.fileFormat && (
              <Badge color="yellow">
                {policy.latest.fileFormat.toUpperCase()}
              </Badge>
            )}
            <span className="text-[11px] text-ey-sonic-silver">
              v{policy.latest?.version ?? "?"}
            </span>
            {!policy.isPrimary && (
              <Badge color="default">Shared from another section</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-ey-sonic-silver shrink-0">
            <span>{summarizeScope(scope)}</span>
            <span>
              {eligibleCount}/{questions.length} questions
            </span>
            <span>{expanded ? "−" : "+"}</span>
          </div>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label={`Delete ${policy.title}`}
          title="Delete this policy everywhere"
          className="px-3 border-l border-ey-sonic-silver/30 text-ey-sonic-silver hover:text-frame-red hover:bg-frame-red/5 transition-colors shrink-0"
        >
          🗑
        </button>
      </div>

      {expanded && (
        <div className="border-t border-ey-sonic-silver/30 p-4 space-y-5 bg-black/30">
          {policy.otherSections.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-ey-sonic-silver mb-1">
                Also bound to
              </p>
              <div className="flex flex-wrap gap-1.5">
                {policy.otherSections.map((s) => (
                  <span
                    key={s.slug}
                    className="text-[11px] px-2 py-0.5 rounded-full border border-ey-sonic-silver/40 text-ey-light-gray"
                  >
                    {s.displayName}
                  </span>
                ))}
              </div>
            </div>
          )}

          <DescriptionEditor
            initial={policy.description}
            onSave={(d) => onMetaChange({ description: d })}
          />

          <div>
            <p className="text-[10px] uppercase tracking-wider text-ey-sonic-silver mb-2">
              Jurisdiction
            </p>
            <JurisdictionPicker
              value={scope}
              onChange={(v) => onMetaChange({ jurisdictionScope: v })}
            />
          </div>

          {policy.latest?.filename && (
            <div className="text-xs text-ey-sonic-silver">
              File:{" "}
              <span className="text-ey-light-gray">{policy.latest.filename}</span>
              {policy.latest.uploadedAt && (
                <span className="ml-2">
                  uploaded {new Date(policy.latest.uploadedAt).toLocaleString()}
                </span>
              )}
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button variant="secondary" onClick={onReplace}>
              Replace document
            </Button>
            {(policy.otherSections.length > 0 || !policy.isPrimary) && (
              <Button variant="secondary" onClick={onUnbind}>
                Remove from this section
              </Button>
            )}
          </div>

          <div className="border-t border-ey-sonic-silver/20 pt-4 text-xs text-ey-sonic-silver">
            {questions.length === 0
              ? "No questions exist in this section yet."
              : eligibleCount === 0
                ? "Excluded from every question — adjust on the Questions page."
                : `Eligible for ${eligibleCount} of ${questions.length} question${
                    questions.length === 1 ? "" : "s"
                  }. Run scans from `}
            {questions.length > 0 && eligibleCount > 0 && (
              <a href="/authoring/questions" className="text-ey-yellow hover:underline">
                Questions
              </a>
            )}
            {questions.length > 0 && eligibleCount > 0 && "."}
          </div>
        </div>
      )}
    </li>
  );
}

function DescriptionEditor({
  initial,
  onSave,
}: {
  initial: string | null;
  onSave: (description: string | null) => void;
}) {
  const [value, setValue] = useState(initial ?? "");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setValue(initial ?? "");
  }, [initial]);

  if (!editing) {
    return (
      <div>
        <p className="text-[10px] uppercase tracking-wider text-ey-sonic-silver mb-1">
          Description (for you, not the LLM)
        </p>
        <button
          onClick={() => setEditing(true)}
          className="w-full text-left text-xs text-ey-light-gray italic hover:text-white"
        >
          {initial ? initial : "Click to add a short description for yourself"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-ey-sonic-silver mb-1">
        Description
      </p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        autoFocus
        placeholder="Short reminder for yourself — what does this document cover?"
        className="w-full px-3 py-2 rounded bg-black border border-ey-sonic-silver/40 text-white text-sm placeholder:text-ey-sonic-silver focus:outline-none focus:border-ey-yellow/50"
      />
      <div className="flex justify-end gap-2 mt-1">
        <button
          onClick={() => {
            setValue(initial ?? "");
            setEditing(false);
          }}
          className="text-xs text-ey-sonic-silver hover:text-white"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            onSave(value.trim() || null);
            setEditing(false);
          }}
          className="text-xs text-ey-yellow hover:underline"
        >
          Save
        </button>
      </div>
    </div>
  );
}

interface ReusablePolicyRow {
  id: string;
  title: string;
  description: string | null;
  sectionBindings: { section: { slug: string; displayName: string } }[];
  latest: { fileFormat: string | null; version: number } | null;
}

function UploadModal({
  sectionSlug,
  sectionLabel,
  replaceTarget,
  onClose,
  onUploaded,
}: {
  sectionSlug: string;
  sectionLabel: string;
  replaceTarget: SectionPolicy | null;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const isReplace = !!replaceTarget;
  const [tab, setTab] = useState<"upload" | "reuse">("upload");

  // Upload tab state
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState(replaceTarget?.title ?? "");
  const [description, setDescription] = useState(replaceTarget?.description ?? "");
  const [scope, setScope] = useState<JurisdictionScope | null>(
    (replaceTarget?.jurisdictionScope as JurisdictionScope) ?? null
  );
  const [effectiveAt, setEffectiveAt] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Reuse tab state
  const [reusable, setReusable] = useState<ReusablePolicyRow[] | null>(null);
  const [reuseSearch, setReuseSearch] = useState("");
  const [pickedReuseId, setPickedReuseId] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== "reuse" || reusable !== null || isReplace) return;
    void fetch("/api/policies")
      .then((r) => r.json())
      .then((all: ReusablePolicyRow[]) => {
        setReusable(
          (Array.isArray(all) ? all : []).filter(
            (p) => !p.sectionBindings.some((b) => b.section.slug === sectionSlug)
          )
        );
      })
      .catch(() => setReusable([]));
  }, [tab, reusable, isReplace, sectionSlug]);

  const reuseFiltered = useMemo(() => {
    if (!reusable) return [];
    const s = reuseSearch.trim().toLowerCase();
    if (!s) return reusable;
    return reusable.filter(
      (p) =>
        p.title.toLowerCase().includes(s) ||
        (p.description ?? "").toLowerCase().includes(s)
    );
  }, [reusable, reuseSearch]);

  const hasInputs =
    !!file ||
    title.trim().length > 0 ||
    description.trim().length > 0 ||
    !!scope ||
    !!pickedReuseId;
  const dirty = hasInputs && !justSaved;

  function markDirtied() {
    if (justSaved) setJustSaved(false);
    if (confirmingDiscard) setConfirmingDiscard(false);
  }

  function pick(f: File | null) {
    setFile(f);
    setError(null);
    markDirtied();
    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  function detectedFormat(): string | null {
    if (!file) return null;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext) return null;
    if (["pdf", "docx", "xlsx", "csv", "txt", "md"].includes(ext)) return ext;
    return null;
  }

  function attemptClose() {
    if (busy) return;
    if (!dirty) {
      onClose();
      return;
    }
    setConfirmingDiscard(true);
  }

  function discard() {
    setConfirmingDiscard(false);
    onClose();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (confirmingDiscard) {
        setConfirmingDiscard(false);
        return;
      }
      attemptClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, dirty, confirmingDiscard]);

  function triggerSubmit() {
    if (tab === "reuse") {
      void submitReuse();
    } else {
      formRef.current?.requestSubmit();
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a file before saving.");
      return;
    }
    if (!isReplace && !title.trim()) {
      setError("Title is required.");
      return;
    }
    setBusy(true);
    setError(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("effectiveAt", effectiveAt);

    let url: string;
    if (isReplace) {
      url = `/api/policies/${replaceTarget.id}/versions/upload`;
    } else {
      url = "/api/policies/upload";
      fd.append("title", title.trim());
      fd.append("sectionSlug", sectionSlug);
      fd.append("description", description.trim());
      if (scope) fd.append("jurisdictionScope", JSON.stringify(scope));
    }

    const res = await fetch(url, { method: "POST", body: fd });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? "Upload failed");
      setBusy(false);
      return;
    }
    setBusy(false);
    setJustSaved(true);
    onUploaded();
  }

  async function submitReuse() {
    if (!pickedReuseId) {
      setError("Pick an existing policy to reuse.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/policies/${pickedReuseId}/sections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionSlug }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? "Could not bind policy to this section");
      setBusy(false);
      return;
    }
    setBusy(false);
    setJustSaved(true);
    onUploaded();
  }

  const fmt = detectedFormat();
  const canSave =
    !busy &&
    !justSaved &&
    (tab === "reuse"
      ? !!pickedReuseId
      : !!file && (isReplace || title.trim().length > 0));
  const saveLabel = busy
    ? "Saving…"
    : justSaved
      ? "Saved"
      : tab === "reuse"
        ? "Bind to this section"
        : isReplace
          ? "Save replacement"
          : "Save policy";

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div
        className="bg-ey-dark-gray border border-ey-sonic-silver/40 rounded-lg max-w-xl w-full max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-ey-sonic-silver/30">
          <h2 className="text-ey-yellow text-base font-semibold truncate">
            {isReplace
              ? `Replace: ${replaceTarget.title}`
              : `Add policy — ${sectionLabel}`}
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            <Button onClick={triggerSubmit} disabled={!canSave}>
              {saveLabel}
            </Button>
            <button
              type="button"
              onClick={attemptClose}
              disabled={busy}
              aria-label="Close"
              title="Close"
              className="w-9 h-9 inline-flex items-center justify-center rounded-md text-base font-bold border border-frame-red/40 text-frame-red hover:bg-frame-red hover:text-white hover:border-frame-red disabled:opacity-50 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {!isReplace && (
          <div className="flex border-b border-ey-sonic-silver/30">
            <TabButton
              active={tab === "upload"}
              onClick={() => {
                setTab("upload");
                markDirtied();
              }}
              label="Upload new"
            />
            <TabButton
              active={tab === "reuse"}
              onClick={() => {
                setTab("reuse");
                markDirtied();
              }}
              label="Reuse existing"
            />
          </div>
        )}

        {error && (
          <div className="px-5 py-3 border-b border-frame-red/40 bg-frame-red/10">
            <p className="text-xs text-frame-red font-semibold mb-0.5">
              Save failed
            </p>
            <p className="text-xs text-ey-light-gray">{error}</p>
          </div>
        )}

        {tab === "upload" || isReplace ? (
          <form
            ref={formRef}
            onSubmit={submit}
            className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
          >
            {isReplace && (
              <p className="text-xs text-ey-sonic-silver">
                This adds a new version of the policy. The old version stays in
                the audit trail. Snippets generated from the previous version
                will be flagged as policy-stale until they&apos;re re-scanned.
              </p>
            )}

            <div className="space-y-1">
              <label className="block text-sm font-medium text-ey-light-gray">
                File <span className="text-frame-red">*</span>
              </label>
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-ey-sonic-silver/40 rounded-lg p-4 text-center cursor-pointer hover:border-ey-yellow/50 transition-colors"
              >
                {file ? (
                  <div className="text-sm">
                    <p className="text-white truncate">{file.name}</p>
                    <p className="text-xs text-ey-sonic-silver mt-1">
                      {(file.size / 1024).toFixed(1)} KB ·{" "}
                      {fmt ? (
                        <span className="text-ey-yellow uppercase">{fmt}</span>
                      ) : (
                        <span className="text-frame-red">Unknown format</span>
                      )}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-ey-light-gray">Click to choose a file</p>
                    <p className="text-xs text-ey-sonic-silver mt-1">
                      PDF, DOCX, XLSX, CSV, TXT, MD
                    </p>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPT}
                  className="hidden"
                  onChange={(e) => pick(e.target.files?.[0] ?? null)}
                />
              </div>
              {file && (fmt === "pdf" || fmt === "docx") && (
                <div className="rounded border border-frame-orange/40 bg-frame-orange/5 p-2.5 text-xs text-ey-light-gray space-y-1">
                  <p className="text-frame-orange font-medium">
                    Heads up — only the text layer is extracted
                  </p>
                  <p>
                    {fmt === "pdf" ? "PDFs" : "Word documents"} commonly include
                    diagrams, charts, and embedded images. Those won&apos;t be
                    read. If a visual carries policy meaning (a decision tree, a
                    process diagram, an org chart), re-author it as text or a
                    list before uploading — otherwise the AI scan won&apos;t see
                    it.
                  </p>
                  <p className="text-ey-sonic-silver">
                    Image-only PDFs (scans without a text layer) will extract
                    almost nothing.
                  </p>
                </div>
              )}
              <p className="text-xs text-ey-sonic-silver">
                PowerPoint isn&apos;t accepted — re-author content in PDF, DOCX,
                or Markdown.
              </p>
            </div>

            {!isReplace && (
              <>
                <Input
                  label="Title"
                  name="title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    markDirtied();
                  }}
                  placeholder="e.g., EY Global Information Security Policy"
                  required
                />

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-ey-light-gray">
                    Description (for you, not the LLM)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      markDirtied();
                    }}
                    rows={2}
                    placeholder="What this document covers (one sentence, for your own reference)"
                    className="w-full px-3 py-2 rounded-lg bg-black border border-ey-sonic-silver/50 text-white placeholder:text-ey-sonic-silver focus:outline-none focus:border-ey-yellow/50 transition-colors text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-ey-light-gray">
                    Jurisdiction
                  </label>
                  <JurisdictionPicker
                    value={scope}
                    onChange={(v) => {
                      setScope(v);
                      markDirtied();
                    }}
                  />
                </div>
              </>
            )}

            <Input
              label="Effective date"
              name="effectiveAt"
              type="date"
              value={effectiveAt}
              onChange={(e) => {
                setEffectiveAt(e.target.value);
                markDirtied();
              }}
              required
            />

            <button type="submit" className="hidden" tabIndex={-1} aria-hidden />
          </form>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            <p className="text-xs text-ey-sonic-silver">
              Pick a policy you&apos;ve already uploaded under another section.
              The same document will inform questions in {sectionLabel} too —
              no second upload, no second version.
            </p>
            <input
              type="text"
              value={reuseSearch}
              onChange={(e) => setReuseSearch(e.target.value)}
              placeholder="Filter by title or description…"
              className="w-full px-3 py-2 rounded bg-black border border-ey-sonic-silver/40 text-white text-sm placeholder:text-ey-sonic-silver focus:outline-none focus:border-ey-yellow/50"
            />
            {reusable === null ? (
              <p className="text-xs text-ey-sonic-silver">Loading…</p>
            ) : reuseFiltered.length === 0 ? (
              <p className="text-xs text-ey-sonic-silver italic">
                {reusable.length === 0
                  ? "No policies elsewhere available to reuse."
                  : "No matches for that filter."}
              </p>
            ) : (
              <ul className="space-y-2">
                {reuseFiltered.map((p) => {
                  const picked = pickedReuseId === p.id;
                  return (
                    <li key={p.id}>
                      <button
                        onClick={() => {
                          setPickedReuseId(picked ? null : p.id);
                          markDirtied();
                        }}
                        className={`w-full text-left px-3 py-2 rounded border transition-colors ${
                          picked
                            ? "border-ey-yellow bg-ey-yellow/5"
                            : "border-ey-sonic-silver/30 hover:border-ey-yellow/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-sm text-white font-medium truncate">
                            {p.title}
                          </span>
                          {p.latest?.fileFormat && (
                            <Badge color="yellow">
                              {p.latest.fileFormat.toUpperCase()}
                            </Badge>
                          )}
                        </div>
                        {p.description && (
                          <p className="text-[11px] text-ey-light-gray line-clamp-2">
                            {p.description}
                          </p>
                        )}
                        <p className="text-[10px] text-ey-sonic-silver mt-1">
                          Currently in:{" "}
                          {p.sectionBindings
                            .map((b) => b.section.displayName)
                            .join(", ") || "—"}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {confirmingDiscard ? (
          <div className="px-5 py-3 border-t border-frame-red/40 bg-frame-red/10 flex items-center justify-between gap-3">
            <p className="text-xs text-frame-red font-medium">
              Discard your work? Your file, jurisdiction, and description will
              be lost.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="secondary"
                onClick={() => setConfirmingDiscard(false)}
              >
                Keep editing
              </Button>
              <Button variant="danger" onClick={discard}>
                Discard
              </Button>
            </div>
          </div>
        ) : (
          <div className="px-5 py-3 border-t border-ey-sonic-silver/30 flex items-center justify-between gap-3">
            <p
              className={`text-[11px] ${
                justSaved ? "text-frame-green" : "text-ey-sonic-silver"
              }`}
            >
              {busy
                ? tab === "reuse"
                  ? "Binding to this section…"
                  : "Saving — extraction can take a few seconds for large PDFs…"
                : justSaved
                  ? "Saved. You can close this dialog."
                  : dirty
                    ? `Unsaved changes — click ${saveLabel} to commit.`
                    : "Nothing entered yet."}
            </p>
            <Button onClick={triggerSubmit} disabled={!canSave}>
              {saveLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
        active
          ? "text-ey-yellow border-b-2 border-ey-yellow"
          : "text-ey-light-gray hover:text-white border-b-2 border-transparent"
      }`}
    >
      {label}
    </button>
  );
}
