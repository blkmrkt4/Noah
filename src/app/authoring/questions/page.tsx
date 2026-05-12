"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, PageTitle } from "@/components/ui";
import { GuidanceRender } from "@/components/GuidanceRender";

type ScanState = "idle" | "running" | "done" | "error";

type GuidanceStatus = "fresh" | "pending" | "stale" | "missing";

interface SectionRow {
  id: string;
  slug: string;
  displayName: string;
  displayOrder: number;
  policyCount: number;
  questionCount: number;
}

interface SectionPolicy {
  id: string;
  title: string;
  isPrimary: boolean;
  otherSections: { slug: string; displayName: string }[];
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
  guidanceStatus: GuidanceStatus;
  guidanceRequired: boolean;
}

interface SectionPayload {
  section: { id: string; slug: string; displayName: string };
  policies: SectionPolicy[];
  questions: SectionQuestion[];
}

interface PublishedGuidance {
  id: string;
  body: string;
  approvedAt: string | null;
  isStaleForCurrentQuestion: boolean;
  sourcePolicyTitle: string | null;
}

const HIDDEN_SECTIONS = new Set(["intake", "triage"]);

const STATUS_META: Record<
  GuidanceStatus,
  { dot: string; label: string; tone: "green" | "yellow" | "orange" | "default" }
> = {
  fresh: { dot: "bg-frame-green", label: "Published", tone: "green" },
  pending: { dot: "bg-ey-yellow", label: "Drafts pending", tone: "yellow" },
  stale: { dot: "bg-frame-orange", label: "Stale", tone: "orange" },
  missing: { dot: "bg-ey-sonic-silver/50", label: "Not scanned", tone: "default" },
};

export default function AuthoringQuestionsPage() {
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [data, setData] = useState<SectionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  const [guidance, setGuidance] = useState<Record<string, PublishedGuidance | null>>({});
  const [guidanceLoading, setGuidanceLoading] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [scanState, setScanState] = useState<Record<string, ScanState>>({});
  const [scanErrors, setScanErrors] = useState<Record<string, string>>({});
  const [scanProduced, setScanProduced] = useState<Record<string, number>>({});

  const refreshSections = useCallback(async () => {
    const res = await fetch("/api/sections");
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
    setExpandedQuestionId(null);
    setGuidance({});
  }, [activeSlug]);

  useEffect(() => {
    void refreshSections();
  }, [refreshSections]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    void fetch("/api/users")
      .then((r) => r.json())
      .then((users) => {
        if (Array.isArray(users) && users.length > 0) setCurrentUserId(users[0].id);
      });
  }, []);

  // Reset scan state when the active section changes.
  useEffect(() => {
    setScanState({});
    setScanErrors({});
    setScanProduced({});
  }, [activeSlug]);

  // Lazy-load guidance preview when a row is expanded.
  useEffect(() => {
    if (!expandedQuestionId) return;
    if (Object.prototype.hasOwnProperty.call(guidance, expandedQuestionId)) return;
    setGuidanceLoading((s) => new Set(s).add(expandedQuestionId));
    void fetch(`/api/questions/${expandedQuestionId}/more-info`)
      .then((r) => r.json())
      .then((json) => {
        setGuidance((g) => ({
          ...g,
          [expandedQuestionId]: json?.snippet ?? null,
        }));
      })
      .catch(() => {
        setGuidance((g) => ({ ...g, [expandedQuestionId]: null }));
      })
      .finally(() => {
        setGuidanceLoading((s) => {
          const next = new Set(s);
          next.delete(expandedQuestionId);
          return next;
        });
      });
  }, [expandedQuestionId, guidance]);

  async function runScans() {
    if (!data || !currentUserId) return;

    type Plan = { policyDocId: string; questionVersionIds: string[] };
    const plans: Plan[] = data.policies
      .map((p) => {
        const excluded = new Set(p.excludedQuestionVersionIds);
        const ids = data.questions
          .filter((q) => q.guidanceRequired && !excluded.has(q.questionVersionId))
          .map((q) => q.questionVersionId);
        return { policyDocId: p.id, questionVersionIds: ids };
      })
      .filter((plan) => plan.questionVersionIds.length > 0);

    if (plans.length === 0) return;

    const initial: Record<string, ScanState> = {};
    for (const plan of plans) initial[plan.policyDocId] = "running";
    setScanState(initial);
    setScanErrors({});
    setScanProduced({});

    await Promise.all(
      plans.map(async (plan) => {
        try {
          const res = await fetch("/api/scans", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              policyDocId: plan.policyDocId,
              questionVersionIds: plan.questionVersionIds,
              triggeredById: currentUserId,
            }),
          });
          const json = await res.json().catch(() => ({}));
          const produced: number = json.itemsProduced ?? 0;
          const errors: { message: string }[] = Array.isArray(json.errors)
            ? json.errors
            : [];

          // Treat as error if HTTP failed, OR if zero items were produced and
          // we have at least one job error — the route returns 201 even when
          // every job fails, so we must inspect the body.
          if (!res.ok || (produced === 0 && errors.length > 0)) {
            const message = !res.ok
              ? json.error ?? `HTTP ${res.status}`
              : errors[0]?.message ?? "All jobs failed";
            setScanState((s) => ({ ...s, [plan.policyDocId]: "error" }));
            setScanErrors((e) => ({ ...e, [plan.policyDocId]: message }));
            return;
          }

          setScanState((s) => ({ ...s, [plan.policyDocId]: "done" }));
          setScanProduced((p) => ({ ...p, [plan.policyDocId]: produced }));
          if (errors.length > 0) {
            // Partial success — flag the first error so it isn't silent.
            setScanErrors((e) => ({
              ...e,
              [plan.policyDocId]: `${errors.length} of ${plan.questionVersionIds.length} jobs failed: ${errors[0].message}`,
            }));
          }
        } catch (err) {
          setScanState((s) => ({ ...s, [plan.policyDocId]: "error" }));
          setScanErrors((e) => ({
            ...e,
            [plan.policyDocId]: (err as Error).message,
          }));
        }
      })
    );

    await reload();
  }

  async function toggleExclusion(
    questionVersionId: string,
    policyDocId: string,
    currentlyExcluded: boolean
  ) {
    if (currentlyExcluded) {
      await fetch(
        `/api/questions/${questionVersionId}/exclusions/${policyDocId}`,
        { method: "DELETE" }
      );
    } else {
      await fetch(`/api/questions/${questionVersionId}/exclusions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyDocId }),
      });
    }
    await reload();
  }

  async function toggleGuidanceRequired(
    questionVersionId: string,
    next: boolean
  ) {
    await fetch(`/api/questions/${questionVersionId}/guidance-required`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guidanceRequired: next }),
    });
    await reload();
  }

  const activeSection = sections.find((s) => s.slug === activeSlug) ?? null;

  return (
    <div className="flex h-full min-h-0">
      <Rail
        sections={sections}
        activeSlug={activeSlug}
        onPick={(slug) => setActiveSlug(slug)}
      />

      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="px-6 py-6 max-w-5xl">
          <PageTitle>
            Questions{activeSection ? ` — ${activeSection.displayName}` : ""}
          </PageTitle>
          <p className="text-sm text-ey-light-gray mt-2 mb-5">
            Each question inherits the policies bound to this section in{" "}
            <a href="/authoring/policies" className="text-ey-yellow hover:underline">
              Policies
            </a>
            . Click a chip to exclude a policy from a specific question. Click a
            row to preview its guidance.
          </p>

          {loading || !data ? (
            <p className="text-sm text-ey-sonic-silver">Loading…</p>
          ) : data.policies.length === 0 ? (
            <EmptyPolicies sectionLabel={activeSection?.displayName ?? "this section"} />
          ) : data.questions.length === 0 ? (
            <p className="text-sm text-ey-sonic-silver">
              No questions in this section yet. Add them to the risk library YAML in{" "}
              <code className="text-ey-yellow font-mono">docs/questions/</code>
              {" "}and re-seed.
            </p>
          ) : (
            <>
              <ScanBar
                policies={data.policies}
                questions={data.questions}
                scanState={scanState}
                scanErrors={scanErrors}
                scanProduced={scanProduced}
                onRun={runScans}
                disabled={!currentUserId}
              />
              <ul className="space-y-1.5">
                {data.questions.map((q) => (
                  <QuestionRow
                    key={q.questionVersionId}
                    question={q}
                    policies={data.policies}
                    expanded={expandedQuestionId === q.questionVersionId}
                    guidance={guidance[q.questionVersionId]}
                    guidanceLoading={guidanceLoading.has(q.questionVersionId)}
                    onToggleExpand={() =>
                      setExpandedQuestionId((cur) =>
                        cur === q.questionVersionId ? null : q.questionVersionId
                      )
                    }
                    onToggleExclusion={(policyDocId, currentlyExcluded) =>
                      toggleExclusion(q.questionVersionId, policyDocId, currentlyExcluded)
                    }
                    onToggleGuidanceRequired={(next) =>
                      toggleGuidanceRequired(q.questionVersionId, next)
                    }
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      </main>
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
                  s.questionCount === 0
                    ? "text-ey-sonic-silver"
                    : isActive
                      ? "bg-ey-yellow/20 text-ey-yellow"
                      : "bg-ey-dark-gray text-ey-light-gray"
                }`}
              >
                {s.questionCount}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function EmptyPolicies({ sectionLabel }: { sectionLabel: string }) {
  return (
    <div className="rounded border border-dashed border-ey-sonic-silver/40 px-4 py-6 text-sm text-ey-sonic-silver">
      No policies are bound to {sectionLabel} yet. Add at least one from{" "}
      <a href="/authoring/policies" className="text-ey-yellow hover:underline">
        Authoring → Policies
      </a>
      .
    </div>
  );
}

function QuestionRow({
  question,
  policies,
  expanded,
  guidance,
  guidanceLoading,
  onToggleExpand,
  onToggleExclusion,
  onToggleGuidanceRequired,
}: {
  question: SectionQuestion;
  policies: SectionPolicy[];
  expanded: boolean;
  guidance: PublishedGuidance | null | undefined;
  guidanceLoading: boolean;
  onToggleExpand: () => void;
  onToggleExclusion: (policyDocId: string, currentlyExcluded: boolean) => void;
  onToggleGuidanceRequired: (next: boolean) => void;
}) {
  const excludedSet = useMemo(
    () => new Set(question.excludedPolicyIds),
    [question.excludedPolicyIds]
  );
  const status = STATUS_META[question.guidanceStatus];
  const guidanceOff = !question.guidanceRequired;
  const canExpand = !guidanceOff;

  return (
    <li
      className={`rounded border transition-colors ${
        expanded
          ? "border-ey-yellow/50 bg-ey-dark-gray"
          : "border-ey-sonic-silver/25 bg-ey-dark-gray/60 hover:border-ey-sonic-silver/50"
      } ${guidanceOff ? "opacity-60" : ""}`}
    >
      <div
        className={`flex items-center gap-3 px-3 py-2 ${canExpand ? "cursor-pointer" : ""}`}
        onClick={canExpand ? onToggleExpand : undefined}
        role={canExpand ? "button" : undefined}
        aria-expanded={canExpand ? expanded : undefined}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleGuidanceRequired(!question.guidanceRequired);
          }}
          title={
            guidanceOff
              ? "Guidance is OFF — click to enable. Scans will produce drafts and Commercial Owners will see a guidance icon."
              : "Guidance is ON — click to disable. No drafts will be generated and the Commercial Owner won't see a guidance icon."
          }
          aria-label={guidanceOff ? "Turn guidance on" : "Turn guidance off"}
          className={`shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold transition-colors ${
            guidanceOff
              ? "border border-ey-sonic-silver/40 text-ey-sonic-silver hover:border-ey-light-gray hover:text-ey-light-gray"
              : "bg-ey-yellow text-ey-black hover:bg-ey-yellow/80"
          }`}
        >
          i
        </button>
        {!guidanceOff && (
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${status.dot}`}
            title={status.label}
            aria-hidden
          />
        )}
        <p
          className={`flex-1 min-w-0 text-sm truncate ${
            guidanceOff ? "text-ey-sonic-silver" : "text-white"
          }`}
          title={question.slug}
        >
          {question.prompt}
        </p>
        {!guidanceOff && (
          <ul
            className="flex items-center gap-1 flex-wrap justify-end max-w-[55%]"
            onClick={(e) => e.stopPropagation()}
          >
            {policies.map((p) => {
              const excluded = excludedSet.has(p.id);
              return (
                <li key={p.id}>
                  <button
                    onClick={() => onToggleExclusion(p.id, excluded)}
                    title={
                      excluded
                        ? `Currently excluded — click to include "${p.title}"`
                        : `Click to exclude "${p.title}" from this question`
                    }
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border transition-colors ${
                      excluded
                        ? "border-ey-sonic-silver/30 text-ey-sonic-silver line-through hover:border-ey-light-gray/40"
                        : "border-ey-yellow/50 text-ey-yellow hover:bg-ey-yellow/10"
                    }`}
                  >
                    {p.title}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {guidanceOff ? (
          <Badge color="default">Guidance off</Badge>
        ) : (
          <Badge color={status.tone}>{status.label}</Badge>
        )}
        {canExpand && (
          <span className="text-ey-sonic-silver text-xs shrink-0">
            {expanded ? "−" : "+"}
          </span>
        )}
      </div>

      {expanded && (
        <div className="border-t border-ey-sonic-silver/20 px-4 py-3 space-y-3">
          {guidanceLoading ? (
            <p className="text-xs text-ey-sonic-silver">Loading guidance…</p>
          ) : !guidance ? (
            <p className="text-xs text-ey-sonic-silver italic">
              No guidance published yet.{" "}
              <a href="/authoring/scans" className="text-ey-yellow hover:underline">
                Open the Guidance editor
              </a>{" "}
              to compose one.
            </p>
          ) : (
            <div className="space-y-2">
              <GuidanceRender body={guidance.body} />
              <div className="flex items-center justify-between gap-2 text-[11px] text-ey-sonic-silver">
                <span>
                  {guidance.approvedAt
                    ? `Published ${new Date(guidance.approvedAt).toLocaleDateString()}`
                    : ""}
                  {guidance.sourcePolicyTitle && ` · from ${guidance.sourcePolicyTitle}`}
                </span>
                <a
                  href="/authoring/scans"
                  className="text-ey-yellow hover:underline"
                >
                  Edit in Guidance editor →
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

type RowState =
  | "running"
  | "just_done"
  | "just_error"
  | "skipped"
  | "scanned"
  | "stale"
  | "not_scanned";

function ScanBar({
  policies,
  questions,
  scanState,
  scanErrors,
  scanProduced,
  onRun,
  disabled,
}: {
  policies: SectionPolicy[];
  questions: SectionQuestion[];
  scanState: Record<string, ScanState>;
  scanErrors: Record<string, string>;
  scanProduced: Record<string, number>;
  onRun: () => void;
  disabled: boolean;
}) {
  const guidanceOnQuestions = useMemo(
    () => questions.filter((q) => q.guidanceRequired),
    [questions]
  );

  const rows = useMemo(
    () =>
      policies.map((p) => {
        const excluded = new Set(p.excludedQuestionVersionIds);
        const eligible = guidanceOnQuestions.filter(
          (q) => !excluded.has(q.questionVersionId)
        );
        const session = scanState[p.id] ?? "idle";

        let state: RowState;
        if (eligible.length === 0) state = "skipped";
        else if (session === "running") state = "running";
        else if (session === "done") state = "just_done";
        else if (session === "error") state = "just_error";
        else if (p.scanStatus === "scanned") state = "scanned";
        else if (p.scanStatus === "stale") state = "stale";
        else state = "not_scanned";

        return {
          id: p.id,
          title: p.title,
          eligibleCount: eligible.length,
          excludedCount: excluded.size,
          state,
          error: scanErrors[p.id],
          produced: scanProduced[p.id],
        };
      }),
    [policies, questions, scanState, scanErrors, scanProduced]
  );

  const runnable = rows.filter((r) => r.state !== "skipped");
  const totalCalls = runnable.reduce((sum, r) => sum + r.eligibleCount, 0);
  const anyRunning = rows.some((r) => r.state === "running");
  const allAlreadyScanned =
    runnable.length > 0 &&
    runnable.every(
      (r) => r.state === "scanned" || r.state === "just_done"
    );
  const buttonLabel = anyRunning
    ? "Running…"
    : allAlreadyScanned
      ? `Re-run ${runnable.length} scan${runnable.length === 1 ? "" : "s"}`
      : `Run ${runnable.length} scan${runnable.length === 1 ? "" : "s"}`;

  const apiKeyError = rows.find(
    (r) => r.error && r.error.includes("OpenRouter API key")
  );

  return (
    <div className="mb-5 rounded-lg border border-ey-sonic-silver/30 bg-ey-dark-gray p-4">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">Run scans for this section</p>
          <p className="text-xs text-ey-sonic-silver mt-0.5">
            One scan per policy against its eligible questions. Each run treats
            the policy as a fresh document — new drafts appear alongside any
            existing ones.
          </p>
        </div>
        <Button
          onClick={onRun}
          disabled={disabled || anyRunning || runnable.length === 0}
        >
          {buttonLabel}
        </Button>
      </div>

      {apiKeyError && (
        <div className="mb-3 rounded border border-frame-red/40 bg-frame-red/5 p-2.5 text-xs">
          <p className="text-frame-red font-medium">OpenRouter API key not configured</p>
          <p className="text-ey-light-gray mt-0.5">
            Every scan will fail until a key is set at{" "}
            <a href="/admin/settings" className="text-ey-yellow hover:underline">
              /admin/settings
            </a>
            .
          </p>
        </div>
      )}

      <ul className="space-y-1">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex items-start gap-3 text-xs px-2 py-1.5 rounded border border-ey-sonic-silver/20 bg-black/20"
          >
            <span className="pt-0.5">
              <ScanRowIcon state={r.state} />
            </span>
            <span className="text-white truncate flex-1 min-w-0">{r.title}</span>
            <div className="text-right shrink-0 max-w-[55%]">
              <span className="text-ey-sonic-silver">
                {r.state === "skipped"
                  ? "Excluded from every question — skipped"
                  : r.state === "running"
                    ? `Scanning ${r.eligibleCount} question${r.eligibleCount === 1 ? "" : "s"}…`
                    : r.state === "just_done"
                      ? `Scanned ${r.produced ?? r.eligibleCount} of ${guidanceOnQuestions.length} questions`
                      : r.state === "just_error"
                        ? "Failed"
                        : r.state === "scanned"
                          ? `Already scanned · ${r.eligibleCount} of ${guidanceOnQuestions.length} questions`
                          : r.state === "stale"
                            ? `Stale (older policy version) · ${r.eligibleCount} of ${guidanceOnQuestions.length}`
                            : `${r.eligibleCount} of ${guidanceOnQuestions.length} questions${
                                r.excludedCount > 0 ? ` · ${r.excludedCount} excluded` : ""
                              }`}
              </span>
              {r.state === "just_error" && r.error && (
                <p className="text-frame-red mt-0.5 truncate" title={r.error}>
                  {r.error}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between text-[11px] text-ey-sonic-silver">
        <span>
          {runnable.length === 0
            ? "Nothing to scan — every policy is excluded from every question."
            : `Total: ${runnable.length} scan${runnable.length === 1 ? "" : "s"} · ${totalCalls} question/policy call${totalCalls === 1 ? "" : "s"}`}
        </span>
        {(allAlreadyScanned || rows.some((r) => r.state === "just_done")) && (
          <a href="/authoring/scans" className="text-ey-yellow hover:underline">
            Open Guidance editor →
          </a>
        )}
      </div>
    </div>
  );
}

function ScanRowIcon({ state }: { state: RowState }) {
  if (state === "running") {
    return (
      <span
        className="block w-3 h-3 rounded-full border-2 border-ey-yellow border-t-transparent animate-spin shrink-0"
        aria-label="Scanning"
      />
    );
  }
  if (state === "just_done" || state === "scanned") {
    return (
      <span
        className="block w-2 h-2 rounded-full bg-frame-green shrink-0"
        aria-label="Scanned"
      />
    );
  }
  if (state === "stale") {
    return (
      <span
        className="block w-2 h-2 rounded-full bg-frame-orange shrink-0"
        aria-label="Stale"
      />
    );
  }
  if (state === "just_error") {
    return (
      <span
        className="block w-2 h-2 rounded-full bg-frame-red shrink-0"
        aria-label="Error"
      />
    );
  }
  if (state === "skipped") {
    return (
      <span
        className="block w-2 h-2 rounded-full bg-ey-sonic-silver/30 shrink-0"
        aria-label="Skipped"
      />
    );
  }
  return (
    <span
      className="block w-2 h-2 rounded-full border border-ey-sonic-silver/60 shrink-0"
      aria-label="Not scanned"
    />
  );
}
