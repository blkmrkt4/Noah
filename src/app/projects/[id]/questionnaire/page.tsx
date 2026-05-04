"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageTitle, Card, Badge, Button, SectionTitle } from "@/components/ui";

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
  answer: {
    id: string;
    value: unknown;
    source: string;
    aiConfidence: number | null;
    citation: string | null;
    inClarification: boolean;
  } | null;
}

export default function QuestionnairePage() {
  const { id } = useParams<{ id: string }>();
  const [questions, setQuestions] = useState<QuestionAnswer[]>([]);
  const [activeSection, setActiveSection] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadQuestions();
  }, [id]);

  async function loadQuestions() {
    const res = await fetch(`/api/projects/${id}/answers`);
    const data = await res.json();
    setQuestions(data);
    if (!activeSection && data.length > 0) {
      setActiveSection(data[0].section);
    }
    setLoading(false);
  }

  async function saveAnswer(questionVersionId: string, value: unknown) {
    setSaving(questionVersionId);
    await fetch(`/api/projects/${id}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questionVersionId,
        value,
        source: "owner_attested",
      }),
    });
    await loadQuestions();
    setSaving(null);
  }

  async function triggerIngestion() {
    await fetch(`/api/projects/${id}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actions: ["pre_populate"] }),
    });
    await loadQuestions();
  }

  if (loading) return <div className="p-8 text-ey-sonic-silver">Loading questionnaire...</div>;

  // Group active questions by section
  const activeQuestions = questions.filter((q) => q.isActive);
  const sections = Array.from(new Set(activeQuestions.map((q) => q.section)));
  const sectionNames = new Map(activeQuestions.map((q) => [q.section, q.sectionName]));
  const sectionQuestions = activeQuestions.filter((q) => q.section === activeSection);

  // Progress per section
  const sectionProgress = sections.map((s) => {
    const qs = activeQuestions.filter((q) => q.section === s);
    const answered = qs.filter((q) => q.answer !== null).length;
    return { section: s, total: qs.length, answered };
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <PageTitle>Questionnaire</PageTitle>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={triggerIngestion}>
            AI Pre-populate
          </Button>
          <a href={`/projects/${id}`}>
            <Button variant="secondary">Back to Project</Button>
          </a>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Section Nav */}
        <nav className="w-64 flex-shrink-0">
          <div className="sticky top-4 space-y-1">
            {sections.map((s) => {
              const progress = sectionProgress.find((sp) => sp.section === s);
              const isActive = s === activeSection;
              return (
                <button
                  key={s}
                  onClick={() => setActiveSection(s)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-ey-yellow/10 text-ey-yellow border border-ey-yellow/30"
                      : "text-ey-light-gray hover:text-white hover:bg-ey-dark-gray"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{sectionNames.get(s)}</span>
                    <span className="text-xs opacity-70">
                      {progress?.answered}/{progress?.total}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Questions */}
        <div className="flex-1 space-y-4">
          <SectionTitle>{sectionNames.get(activeSection)}</SectionTitle>

          {sectionQuestions.map((q) => (
            <QuestionCard
              key={q.questionVersionId}
              question={q}
              saving={saving === q.questionVersionId}
              onSave={(value) => saveAnswer(q.questionVersionId, value)}
            />
          ))}

          {sectionQuestions.length === 0 && (
            <Card>
              <p className="text-ey-sonic-silver text-center py-4">
                No active questions in this section yet. Answer foundational
                questions to activate dependent sections.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  saving,
  onSave,
}: {
  question: QuestionAnswer;
  saving: boolean;
  onSave: (value: unknown) => void;
}) {
  const [localValue, setLocalValue] = useState<unknown>(question.answer?.value ?? "");

  useEffect(() => {
    setLocalValue(question.answer?.value ?? "");
  }, [question.answer?.value]);

  const hasAiAnswer = question.answer?.source === "system_inferred";

  return (
    <Card className={question.answer?.inClarification ? "border-frame-orange/50" : ""}>
      <div className="space-y-3">
        {/* Question header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-white font-medium text-sm">{question.prompt}</p>
            {question.helpText && (
              <p className="text-ey-sonic-silver text-xs mt-1">{question.helpText}</p>
            )}
          </div>
          <div className="flex gap-2 ml-4">
            {question.required && <Badge color="red">Required</Badge>}
            {hasAiAnswer && (
              <Badge color="blue">
                AI {Math.round((question.answer!.aiConfidence || 0) * 100)}%
              </Badge>
            )}
            {question.answer?.inClarification && (
              <Badge color="orange">Clarification</Badge>
            )}
          </div>
        </div>

        {/* AI citation */}
        {hasAiAnswer && question.answer?.citation && (
          <div className="bg-frame-blue/5 border border-frame-blue/20 rounded p-2 text-xs text-frame-blue">
            {question.answer.citation}
          </div>
        )}

        {/* Answer input */}
        <div>
          {question.answerType === "boolean" && (
            <div className="flex gap-3">
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
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    localValue === opt.value
                      ? "border-ey-yellow bg-ey-yellow/10 text-ey-yellow"
                      : "border-ey-sonic-silver/50 text-ey-light-gray hover:border-ey-yellow/30"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {question.answerType === "single_select" && question.options && (
            <div className="space-y-2">
              {question.options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setLocalValue(opt.value);
                    onSave(opt.value);
                  }}
                  className={`w-full text-left px-4 py-2 rounded-lg text-sm border transition-colors ${
                    localValue === opt.value
                      ? "border-ey-yellow bg-ey-yellow/10 text-ey-yellow"
                      : "border-ey-sonic-silver/30 text-ey-light-gray hover:border-ey-yellow/30"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {question.answerType === "multi_select" && question.options && (
            <div className="space-y-2">
              {question.options.map((opt) => {
                const selected = Array.isArray(localValue) && (localValue as string[]).includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => {
                      const current = Array.isArray(localValue) ? [...(localValue as string[])] : [];
                      const next = selected
                        ? current.filter((v) => v !== opt.value)
                        : [...current, opt.value];
                      setLocalValue(next);
                      onSave(next);
                    }}
                    className={`w-full text-left px-4 py-2 rounded-lg text-sm border transition-colors ${
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
          )}

          {(question.answerType === "text_short" || question.answerType === "url") && (
            <div className="flex gap-2">
              <input
                type={question.answerType === "url" ? "url" : "text"}
                value={(localValue as string) || ""}
                onChange={(e) => setLocalValue(e.target.value)}
                placeholder={question.answerType === "url" ? "https://..." : "Type your answer..."}
                className="flex-1 px-3 py-2 rounded-lg bg-black border border-ey-sonic-silver/50 text-white placeholder:text-ey-sonic-silver focus:outline-none focus:border-ey-yellow/50 text-sm"
              />
              <Button
                variant="secondary"
                onClick={() => onSave(localValue)}
                disabled={saving}
              >
                {saving ? "..." : "Save"}
              </Button>
            </div>
          )}

          {question.answerType === "text_long" && (
            <div className="space-y-2">
              <textarea
                value={(localValue as string) || ""}
                onChange={(e) => setLocalValue(e.target.value)}
                rows={4}
                placeholder="Type your answer..."
                className="w-full px-3 py-2 rounded-lg bg-black border border-ey-sonic-silver/50 text-white placeholder:text-ey-sonic-silver focus:outline-none focus:border-ey-yellow/50 text-sm resize-y"
              />
              <Button
                variant="secondary"
                onClick={() => onSave(localValue)}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          )}

          {question.answerType === "number" && (
            <div className="flex gap-2">
              <input
                type="number"
                value={(localValue as string) || ""}
                onChange={(e) => setLocalValue(e.target.value ? Number(e.target.value) : "")}
                className="flex-1 px-3 py-2 rounded-lg bg-black border border-ey-sonic-silver/50 text-white focus:outline-none focus:border-ey-yellow/50 text-sm"
              />
              <Button
                variant="secondary"
                onClick={() => onSave(localValue)}
                disabled={saving}
              >
                {saving ? "..." : "Save"}
              </Button>
            </div>
          )}

          {(question.answerType === "entity_ref" || question.answerType === "entity_ref_multi" || question.answerType === "date") && (
            <div className="flex gap-2">
              <input
                type={question.answerType === "date" ? "date" : "text"}
                value={(localValue as string) || ""}
                onChange={(e) => setLocalValue(e.target.value)}
                placeholder={question.answerType === "date" ? "" : "Enter reference..."}
                className="flex-1 px-3 py-2 rounded-lg bg-black border border-ey-sonic-silver/50 text-white focus:outline-none focus:border-ey-yellow/50 text-sm"
              />
              <Button
                variant="secondary"
                onClick={() => onSave(localValue)}
                disabled={saving}
              >
                {saving ? "..." : "Save"}
              </Button>
            </div>
          )}
        </div>

        {/* Slug reference */}
        <div className="text-xs text-ey-sonic-silver/60 font-mono">{question.slug}</div>
      </div>
    </Card>
  );
}
