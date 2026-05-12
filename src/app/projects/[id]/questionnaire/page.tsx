"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Badge, Button, Card } from "@/components/ui";
import QuestionContextPanel, {
  type QuestionContext,
} from "@/components/QuestionContextPanel";
import NotificationBell from "@/components/NotificationBell";
import { GuidanceRender } from "@/components/GuidanceRender";
import IntakeDocsView from "@/components/IntakeDocsView";

// Slug of the always-present, non-question virtual section that lives at the
// top of the questionnaire's section nav. Its content is the consolidated view
// of scan outputs + uploaded documents + project links.
const INTAKE_DOCS_SLUG = "intake_docs";
const INTAKE_DOCS_LABEL = "Intake Documents and Links";

interface QuestionAnswer {
  questionVersionId: string;
  slug: string;
  section: string;
  sectionName: string;
  prompt: string;
  answerType: string;
  options: { value: string; label: string }[] | null;
  helpText: string | null;
  required: boolean;
  isActive: boolean;
  parentSlug: string | null;
  answer: {
    id: string;
    value: unknown;
    source: "system_inferred" | "owner_attested" | "collaborator_supplied";
    aiConfidence: number | null;
    citation: string | null;
    inClarification: boolean;
    attester: { id: string; name: string; email: string } | null;
    answeredAt?: string;
  } | null;
}

interface SectionStateRow {
  sectionId: string;
  slug: string;
  displayName: string;
  displayOrder: number;
  state: "drafting" | "released" | "under_review" | "cleared";
  progress: { total: number; required: number; answered: number; requiredAnswered: number };
  canRelease: boolean;
}

interface ProjectState {
  commercialOwnerId: string;
  sections: SectionStateRow[];
}

const STATE_LABEL: Record<string, { color: "default" | "blue" | "orange" | "green"; label: string }> = {
  drafting: { color: "default", label: "Drafting" },
  released: { color: "blue", label: "Released" },
  under_review: { color: "orange", label: "Under review" },
  cleared: { color: "green", label: "Cleared" },
};

export default function QuestionnairePage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const sectionFromUrl = searchParams.get("section") ?? "";
  const [questions, setQuestions] = useState<QuestionAnswer[]>([]);
  const [projectState, setProjectState] = useState<ProjectState | null>(null);
  const [activeSection, setActiveSection] = useState<string>(sectionFromUrl);
  const [focusedQVId, setFocusedQVId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadAll();
  }, [id]);

  async function loadAll() {
    const [qRes, sRes] = await Promise.all([
      fetch(`/api/projects/${id}/answers`),
      fetch(`/api/projects/${id}/state`),
    ]);
    const qData: QuestionAnswer[] = await qRes.json();
    const sData: ProjectState = await sRes.json();
    setQuestions(qData);
    setProjectState(sData);
    if (!activeSection && qData.length > 0) {
      const firstActive = qData.find((q) => q.isActive);
      if (firstActive) setActiveSection(firstActive.section);
    }
    setLoading(false);
  }

  async function saveAnswer(questionVersionId: string, value: unknown) {
    setSaving(questionVersionId);
    await fetch(`/api/projects/${id}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionVersionId, value, source: "owner_attested" }),
    });
    await loadAll();
    setSaving(null);
  }

  async function triggerIngestion() {
    setBusy(true);
    await fetch(`/api/projects/${id}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actions: ["pre_populate"] }),
    });
    await loadAll();
    setBusy(false);
  }

  async function releaseSection(sectionId: string) {
    setBusy(true);
    await fetch(`/api/projects/${id}/sections/${sectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "release" }),
    });
    await loadAll();
    setBusy(false);
  }

  const activeQuestions = useMemo(() => questions.filter((q) => q.isActive), [questions]);
  const sectionsList = useMemo(
    () => projectState?.sections.filter((s) => activeQuestions.some((q) => q.section === s.slug)) ?? [],
    [projectState, activeQuestions]
  );
  const sectionQuestions = useMemo(() => {
    const inSection = activeQuestions.filter((q) => q.section === activeSection);
    // Reorder so each child question appears directly after its parent.
    // Without this, the indent + connector line on dependent questions can
    // dangle below an unrelated card.
    const slugSet = new Set(inSection.map((q) => q.slug));
    const childrenByParent = new Map<string, QuestionAnswer[]>();
    const roots: QuestionAnswer[] = [];
    for (const q of inSection) {
      if (q.parentSlug && slugSet.has(q.parentSlug)) {
        const arr = childrenByParent.get(q.parentSlug) ?? [];
        arr.push(q);
        childrenByParent.set(q.parentSlug, arr);
      } else {
        roots.push(q);
      }
    }
    const ordered: QuestionAnswer[] = [];
    function emit(q: QuestionAnswer) {
      ordered.push(q);
      const children = childrenByParent.get(q.slug) ?? [];
      for (const c of children) emit(c);
    }
    for (const r of roots) emit(r);
    return ordered;
  }, [activeQuestions, activeSection]);

  const visibleSlugs = useMemo(
    () => new Set(sectionQuestions.map((q) => q.slug)),
    [sectionQuestions]
  );

  const currentSection = sectionsList.find((s) => s.slug === activeSection);
  const focusedQuestion = sectionQuestions.find((q) => q.questionVersionId === focusedQVId) ?? null;
  const onIntakeDocs = activeSection === INTAKE_DOCS_SLUG;

  // Auto-focus first question when section changes
  useEffect(() => {
    if (sectionQuestions.length > 0 && !sectionQuestions.some((q) => q.questionVersionId === focusedQVId)) {
      setFocusedQVId(sectionQuestions[0].questionVersionId);
    }
  }, [sectionQuestions, focusedQVId]);

  if (loading) return <div className="p-8 text-ey-sonic-silver">Loading questionnaire...</div>;

  return (
    <div className="flex h-[calc(100vh-0px)]">
      {/* Left: section nav */}
      <aside className="w-64 flex-shrink-0 border-r border-ey-dark-gray overflow-y-auto">
        <div className="p-4 border-b border-ey-dark-gray">
          <p className="text-[10px] uppercase tracking-wider text-ey-sonic-silver mb-2">
            Sections
          </p>
        </div>
        <ul>
          {/* Always-first virtual section — orange-tinted, no questions. */}
          <li>
            <button
              onClick={() => setActiveSection(INTAKE_DOCS_SLUG)}
              className={`w-full text-left px-4 py-2.5 transition-colors border-l-2 ${
                onIntakeDocs
                  ? "bg-frame-orange/15 text-frame-orange border-frame-orange"
                  : "text-frame-orange/80 hover:bg-frame-orange/10 hover:text-frame-orange border-frame-orange/30"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold truncate">
                  {INTAKE_DOCS_LABEL}
                </span>
              </div>
              <p className="text-[10px] text-frame-orange/60 mt-1">Always on</p>
            </button>
          </li>
          {sectionsList.map((s) => {
            const isActive = s.slug === activeSection;
            return (
              <li key={s.slug}>
                <button
                  onClick={() => setActiveSection(s.slug)}
                  className={`w-full text-left px-4 py-2.5 transition-colors border-l-2 ${
                    isActive
                      ? "bg-ey-dark-gray text-ey-yellow border-ey-yellow"
                      : "text-ey-light-gray hover:bg-ey-dark-gray hover:text-white border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm truncate">{s.displayName}</span>
                    <span className="text-[10px] text-ey-sonic-silver shrink-0">
                      {s.progress.answered}/{s.progress.total}
                    </span>
                  </div>
                  <div className="mt-1">
                    <Badge color={STATE_LABEL[s.state].color}>{STATE_LABEL[s.state].label}</Badge>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Center: questions OR intake docs view */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-5 border-b border-ey-dark-gray sticky top-0 bg-ey-black z-10 flex items-center justify-between">
          <div>
            {onIntakeDocs ? (
              <>
                <h1 className="text-frame-orange text-xl font-semibold">
                  {INTAKE_DOCS_LABEL}
                </h1>
                <p className="text-xs text-ey-sonic-silver mt-1">
                  Scan outputs, uploaded documents, and reference links.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-ey-yellow text-xl font-semibold">
                  {currentSection?.displayName ?? "Questionnaire"}
                </h1>
                {currentSection && (
                  <div className="flex items-center gap-3 mt-1 text-xs text-ey-sonic-silver">
                    <Badge color={STATE_LABEL[currentSection.state].color}>
                      {STATE_LABEL[currentSection.state].label}
                    </Badge>
                    <span>
                      {currentSection.progress.requiredAnswered} of{" "}
                      {currentSection.progress.required} required
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex gap-2">
            {onIntakeDocs ? (
              <Link href={`/projects/${id}/ingestion`}>
                <Button variant="secondary">Manage on Ingestion page</Button>
              </Link>
            ) : (
              <>
                <Button variant="secondary" onClick={triggerIngestion} disabled={busy}>
                  AI Pre-populate
                </Button>
                {currentSection && (
                  <Button
                    onClick={() => releaseSection(currentSection.sectionId)}
                    disabled={!currentSection.canRelease || busy}
                  >
                    Release section
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="p-6 space-y-3">
          {onIntakeDocs ? (
            <IntakeDocsView projectId={id} />
          ) : sectionQuestions.length === 0 ? (
            <Card>
              <p className="text-ey-sonic-silver text-center py-4">
                No active questions in this section yet. Answer foundational
                questions to activate dependent sections.
              </p>
            </Card>
          ) : (
            sectionQuestions.map((q) => {
              const isChild = !!q.parentSlug && visibleSlugs.has(q.parentSlug);
              return (
                <div
                  key={q.questionVersionId}
                  className={isChild ? "ml-6 pl-4 border-l-2 border-ey-yellow/40" : ""}
                >
                  <QuestionCard
                    question={q}
                    focused={q.questionVersionId === focusedQVId}
                    onFocus={() => setFocusedQVId(q.questionVersionId)}
                    saving={saving === q.questionVersionId}
                    onSave={(value) => saveAnswer(q.questionVersionId, value)}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right: context */}
      <aside className="w-80 flex-shrink-0 border-l border-ey-dark-gray flex flex-col min-h-0">
        <div className="px-5 py-3 border-b border-ey-dark-gray flex items-center justify-between flex-shrink-0">
          <p className="text-[10px] uppercase tracking-wider text-ey-sonic-silver">Context</p>
          {projectState && (
            <NotificationBell userId={projectState.commercialOwnerId} />
          )}
        </div>
        <div className="flex-1 min-h-0">
          <QuestionContextPanel
            projectId={id}
            question={(focusedQuestion as unknown as QuestionContext) ?? null}
            sectionState={currentSection?.state ?? "drafting"}
            commercialOwnerId={projectState?.commercialOwnerId}
            currentSectionSlug={activeSection || null}
          />
        </div>
      </aside>
    </div>
  );
}

interface PublishedGuidance {
  id: string;
  body: string;
  sourcePolicyTitle: string | null;
  sourcePolicyVersion: number | null;
  approvedAt: string | null;
  isStaleForCurrentQuestion: boolean;
}

function QuestionCard({
  question,
  focused,
  onFocus,
  saving,
  onSave,
}: {
  question: QuestionAnswer;
  focused: boolean;
  onFocus: () => void;
  saving: boolean;
  onSave: (value: unknown) => void;
}) {
  const [localValue, setLocalValue] = useState<unknown>(question.answer?.value ?? "");
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [guidance, setGuidance] = useState<PublishedGuidance | null | undefined>(undefined);
  const [riskOpen, setRiskOpen] = useState(false);
  const [risks, setRisks] = useState<{ id: string; slug: string; name: string; description: string | null }[] | undefined>(undefined);

  useEffect(() => {
    setLocalValue(question.answer?.value ?? "");
  }, [question.answer?.value]);

  // Lazy-load the guidance on first open
  useEffect(() => {
    if (!guidanceOpen || guidance !== undefined) return;
    void fetch(`/api/questions/${question.questionVersionId}/more-info`)
      .then((r) => r.json())
      .then((data) => setGuidance(data.snippet ?? null))
      .catch(() => setGuidance(null));
  }, [guidanceOpen, guidance, question.questionVersionId]);

  // Lazy-load risks on first open
  useEffect(() => {
    if (!riskOpen || risks !== undefined) return;
    void fetch(`/api/questions/${question.questionVersionId}/risks`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setRisks(Array.isArray(data) ? data : []))
      .catch(() => setRisks([]));
  }, [riskOpen, risks, question.questionVersionId]);

  // Esc closes open panels
  useEffect(() => {
    if (!guidanceOpen && !riskOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setGuidanceOpen(false);
        setRiskOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [guidanceOpen, riskOpen]);

  const hasAi = question.answer?.source === "system_inferred";
  const answered = !!question.answer;

  return (
    <div
      onClick={onFocus}
      onFocus={onFocus}
      className={`rounded-lg p-4 border transition-colors cursor-pointer ${
        focused
          ? "border-ey-yellow bg-ey-yellow/5"
          : "border-ey-sonic-silver/30 bg-ey-dark-gray hover:border-ey-yellow/30"
      } ${question.answer?.inClarification ? "border-frame-orange/50" : ""}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <p className="text-white font-medium text-sm">{question.prompt}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setGuidanceOpen((v) => !v);
              }}
              aria-label="Guidance"
              className={`shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold border transition-colors ${
                guidanceOpen
                  ? "border-ey-yellow bg-ey-yellow text-black"
                  : "border-ey-sonic-silver/60 text-ey-sonic-silver hover:border-ey-yellow hover:text-ey-yellow"
              }`}
            >
              i
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRiskOpen((v) => !v);
              }}
              aria-label="Related risks"
              className={`shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold border transition-colors ${
                riskOpen
                  ? "border-frame-red bg-frame-red text-white"
                  : "border-ey-sonic-silver/60 text-ey-sonic-silver hover:border-frame-red hover:text-frame-red"
              }`}
            >
              r
            </button>
          </div>
          {question.helpText && (
            <p className="text-ey-sonic-silver text-xs mt-1">{question.helpText}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 shrink-0">
          {question.required && <Badge color="red">Required</Badge>}
          {hasAi && (
            <Badge color="yellow">
              AI {Math.round((question.answer!.aiConfidence || 0) * 100)}%
            </Badge>
          )}
          {answered && !hasAi && <Badge color="blue">Answered</Badge>}
          {question.answer?.inClarification && <Badge color="orange">Clarification</Badge>}
        </div>
      </div>

      {guidanceOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mb-3 rounded border border-ey-yellow/40 bg-ey-yellow/5 p-3 text-xs space-y-2"
        >
          {guidance === undefined ? (
            <p className="text-ey-sonic-silver">Loading…</p>
          ) : guidance === null ? (
            <p className="text-ey-sonic-silver">
              No guidance has been published for this question yet. The Policy
              Author can compose one from{" "}
              <a href="/authoring/scans" className="text-ey-yellow hover:underline">
                Authoring Admin → Guidance editor
              </a>
              .
            </p>
          ) : (
            <>
              <GuidanceRender body={guidance.body} />
              {(guidance.sourcePolicyTitle || guidance.isStaleForCurrentQuestion) && (
                <div className="pt-2 border-t border-ey-yellow/20 space-y-1">
                  {guidance.sourcePolicyTitle && (
                    <p className="text-[10px] text-ey-sonic-silver">
                      Source: {guidance.sourcePolicyTitle}
                      {guidance.sourcePolicyVersion && ` v${guidance.sourcePolicyVersion}`}
                    </p>
                  )}
                  {guidance.isStaleForCurrentQuestion && (
                    <p className="text-[10px] text-frame-orange">
                      ⚠ This guidance was published against an earlier version
                      of the question and may be slightly out of date.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {riskOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mb-3 rounded border border-frame-red/40 bg-frame-red/5 p-3 text-xs space-y-2"
        >
          {risks === undefined ? (
            <p className="text-ey-sonic-silver">Loading…</p>
          ) : risks.length === 0 ? (
            <p className="text-ey-sonic-silver">
              No risks assigned to this question yet.
            </p>
          ) : (
            <div className="space-y-2">
              {risks.map((risk) => (
                <div key={risk.id}>
                  <p className="text-frame-red font-semibold">{risk.name}</p>
                  {risk.description && (
                    <p className="text-ey-light-gray mt-0.5">{risk.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AnswerInput
        question={question}
        localValue={localValue}
        setLocalValue={setLocalValue}
        saving={saving}
        onSave={onSave}
      />
    </div>
  );
}

function AnswerInput({
  question,
  localValue,
  setLocalValue,
  saving,
  onSave,
}: {
  question: QuestionAnswer;
  localValue: unknown;
  setLocalValue: (v: unknown) => void;
  saving: boolean;
  onSave: (v: unknown) => void;
}) {
  if (question.answerType === "boolean") {
    return (
      <div className="flex gap-2">
        {[
          { value: true, label: "Yes" },
          { value: false, label: "No" },
        ].map((opt) => (
          <button
            key={String(opt.value)}
            onClick={() => {
              setLocalValue(opt.value);
              onSave(opt.value);
            }}
            className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
              localValue === opt.value
                ? "border-ey-yellow bg-ey-yellow/10 text-ey-yellow"
                : "border-ey-sonic-silver/40 text-ey-light-gray hover:border-ey-yellow/30"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  if (question.answerType === "single_select" && question.options) {
    return (
      <div className="space-y-1.5">
        {question.options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => {
              setLocalValue(opt.value);
              onSave(opt.value);
            }}
            className={`w-full text-left px-3 py-1.5 rounded text-xs border transition-colors ${
              localValue === opt.value
                ? "border-ey-yellow bg-ey-yellow/10 text-ey-yellow"
                : "border-ey-sonic-silver/30 text-ey-light-gray hover:border-ey-yellow/30"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
  }

  if (question.answerType === "multi_select" && question.options) {
    const arr = Array.isArray(localValue) ? (localValue as string[]) : [];
    return (
      <div className="space-y-1.5">
        {question.options.map((opt) => {
          const selected = arr.includes(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => {
                const next = selected
                  ? arr.filter((v) => v !== opt.value)
                  : [...arr, opt.value];
                setLocalValue(next);
                onSave(next);
              }}
              className={`w-full text-left px-3 py-1.5 rounded text-xs border transition-colors ${
                selected
                  ? "border-ey-yellow bg-ey-yellow/10 text-ey-yellow"
                  : "border-ey-sonic-silver/30 text-ey-light-gray hover:border-ey-yellow/30"
              }`}
            >
              <span className="mr-2">{selected ? "✓" : "○"}</span>
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (question.answerType === "text_long") {
    return (
      <div className="space-y-2">
        <textarea
          value={(localValue as string) || ""}
          onChange={(e) => setLocalValue(e.target.value)}
          rows={3}
          placeholder="Type your answer..."
          className="w-full px-3 py-2 rounded bg-black border border-ey-sonic-silver/40 text-white placeholder:text-ey-sonic-silver focus:outline-none focus:border-ey-yellow/50 text-xs resize-y"
        />
        <Button variant="secondary" onClick={() => onSave(localValue)} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    );
  }

  // fall-through for text_short, url, number, date, entity_ref, entity_ref_multi
  const inputType =
    question.answerType === "url"
      ? "url"
      : question.answerType === "number"
        ? "number"
        : question.answerType === "date"
          ? "date"
          : "text";

  return (
    <div className="flex gap-2">
      <input
        type={inputType}
        value={(localValue as string) ?? ""}
        onChange={(e) => {
          const v =
            question.answerType === "number" && e.target.value
              ? Number(e.target.value)
              : e.target.value;
          setLocalValue(v);
        }}
        placeholder={
          question.answerType === "url"
            ? "https://..."
            : question.answerType === "date"
              ? ""
              : "Type your answer..."
        }
        className="flex-1 px-3 py-1.5 rounded bg-black border border-ey-sonic-silver/40 text-white placeholder:text-ey-sonic-silver focus:outline-none focus:border-ey-yellow/50 text-xs"
      />
      <Button variant="secondary" onClick={() => onSave(localValue)} disabled={saving}>
        {saving ? "..." : "Save"}
      </Button>
    </div>
  );
}
