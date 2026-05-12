"use client";

import { useEffect, useState } from "react";
import { PageTitle, Card, Badge, SectionTitle } from "@/components/ui";

// ── Types ────────────────────────────────────────────────────────────────────

interface CorpusSection {
  id: string;
  slug: string;
  displayName: string;
  displayOrder: number;
  questions: CorpusQuestion[];
}

interface CorpusQuestion {
  id: string;
  slug: string;
  prompt: string;
  answerType: string;
  options?: { value: string; label: string }[] | null;
  helpText?: string | null;
  required: boolean;
  aiPrepopulationPriority?: string;
  dependsOn?: { slug: string; rule: unknown }[];
  activates?: { slug: string; rule: unknown }[];
  sectionSlug?: string;
  sectionName?: string;
}

interface RiskBucket {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  questions: CorpusQuestion[];
}

interface RiskViewData {
  foundation: CorpusQuestion[];
  risks: RiskBucket[];
  unassigned: CorpusQuestion[];
}

type ViewMode = "category" | "risk";

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CorpusPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("category");

  // Category view state
  const [sections, setSections] = useState<CorpusSection[]>([]);
  const [activeSection, setActiveSection] = useState<string>("");

  // Risk view state
  const [riskData, setRiskData] = useState<RiskViewData | null>(null);
  const [activeRisk, setActiveRisk] = useState<string>(""); // risk slug or "__unassigned__"

  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // Fetch category data on mount
  useEffect(() => {
    fetch("/api/corpus")
      .then((r) => r.json())
      .then((data) => {
        setSections(data);
        if (data.length > 0) setActiveSection(data[0].slug);
      })
      .catch(() => setSections([]))
      .finally(() => setLoading(false));
  }, []);

  // Fetch risk data when switching to risk view
  useEffect(() => {
    if (viewMode !== "risk" || riskData) return;
    fetch("/api/corpus?view=risk")
      .then((r) => r.json())
      .then((data: RiskViewData) => {
        setRiskData(data);
        if (data.risks.length > 0) {
          setActiveRisk(data.risks[0].slug);
        } else if (data.unassigned.length > 0) {
          setActiveRisk("__unassigned__");
        }
      })
      .catch(() => setRiskData(null));
  }, [viewMode, riskData]);

  if (loading) return <div className="p-8 text-ey-sonic-silver">Loading risk library...</div>;

  // Build flat question list for search (works across both views)
  const allQuestions: CorpusQuestion[] =
    viewMode === "category"
      ? sections.flatMap((s) =>
          s.questions.map((q) => ({ ...q, sectionSlug: s.slug, sectionName: s.displayName }))
        )
      : riskData
        ? [
            ...riskData.foundation,
            ...riskData.risks.flatMap((r) => r.questions),
            ...riskData.unassigned,
          ]
        : [];

  const searchResults =
    searchTerm.length >= 2
      ? allQuestions.filter(
          (q) =>
            q.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
            q.prompt.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : null;

  return (
    <div className="px-6 py-8 max-w-7xl">
      <PageTitle>Risk Library</PageTitle>

      {/* View toggle + search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
        <div className="inline-flex rounded-lg border border-ey-sonic-silver/30 p-0.5">
          <TogglePill
            active={viewMode === "category"}
            onClick={() => setViewMode("category")}
            label="Department Category"
          />
          <TogglePill
            active={viewMode === "risk"}
            onClick={() => setViewMode("risk")}
            label="Risk"
          />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search questions by slug or text..."
          className="flex-1 max-w-lg px-4 py-2 rounded-lg bg-black border border-ey-sonic-silver/50 text-white placeholder:text-ey-sonic-silver focus:outline-none focus:border-ey-yellow/50 text-sm"
        />
      </div>

      {/* Search Results */}
      {searchResults && (
        <div className="mb-8">
          <SectionTitle>Search Results ({searchResults.length})</SectionTitle>
          <div className="space-y-3">
            {searchResults.slice(0, 20).map((q) => (
              <QuestionRow
                key={q.id}
                question={q}
                showSection
                sectionName={q.sectionName}
              />
            ))}
            {searchResults.length === 0 && (
              <p className="text-ey-sonic-silver text-sm">No questions match your search.</p>
            )}
          </div>
        </div>
      )}

      {/* Category view */}
      {!searchResults && viewMode === "category" && (
        <CategoryBrowser
          sections={sections}
          activeSection={activeSection}
          setActiveSection={setActiveSection}
        />
      )}

      {/* Risk view */}
      {!searchResults && viewMode === "risk" && (
        <RiskBrowser
          data={riskData}
          activeRisk={activeRisk}
          setActiveRisk={setActiveRisk}
        />
      )}
    </div>
  );
}

// ── Toggle pill ──────────────────────────────────────────────────────────────

function TogglePill({
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
      onClick={onClick}
      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
        active
          ? "bg-ey-yellow text-black"
          : "text-ey-light-gray hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

// ── Category browser (original) ──────────────────────────────────────────────

function CategoryBrowser({
  sections,
  activeSection,
  setActiveSection,
}: {
  sections: CorpusSection[];
  activeSection: string;
  setActiveSection: (slug: string) => void;
}) {
  const currentSection = sections.find((s) => s.slug === activeSection);

  return (
    <div className="flex gap-6">
      <nav className="w-56 flex-shrink-0">
        <div className="sticky top-4 space-y-1">
          {sections.map((s) => (
            <button
              key={s.slug}
              onClick={() => setActiveSection(s.slug)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                s.slug === activeSection
                  ? "bg-ey-yellow/10 text-ey-yellow border border-ey-yellow/30"
                  : "text-ey-light-gray hover:text-white hover:bg-ey-dark-gray"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="truncate">{s.displayName}</span>
                <span className="text-xs opacity-70">{s.questions.length}</span>
              </div>
            </button>
          ))}
        </div>
      </nav>

      <div className="flex-1 space-y-4">
        {currentSection && (
          <>
            <div className="flex items-center justify-between">
              <SectionTitle>{currentSection.displayName}</SectionTitle>
              <Badge>{currentSection.questions.length} questions</Badge>
            </div>
            <div className="space-y-3">
              {currentSection.questions.map((q) => (
                <QuestionRow key={q.id} question={q} />
              ))}
              {currentSection.questions.length === 0 && (
                <Card>
                  <p className="text-ey-sonic-silver text-center py-4">
                    No questions in this section yet.
                  </p>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Risk browser ─────────────────────────────────────────────────────────────

function RiskBrowser({
  data,
  activeRisk,
  setActiveRisk,
}: {
  data: RiskViewData | null;
  activeRisk: string;
  setActiveRisk: (slug: string) => void;
}) {
  if (!data) {
    return <p className="text-ey-sonic-silver">Loading risk view...</p>;
  }

  const selectedBucket =
    activeRisk === "__unassigned__"
      ? { name: "Unassigned", description: null, questions: data.unassigned }
      : data.risks.find((r) => r.slug === activeRisk);

  return (
    <div className="space-y-6">
      {/* Foundation questions — always visible at top */}
      {data.foundation.length > 0 && <FoundationBlock questions={data.foundation} />}

      <div className="flex gap-6">
        {/* Risk nav rail */}
        <nav className="w-56 flex-shrink-0">
          <div className="sticky top-4 space-y-1">
            {data.risks.map((r) => (
              <button
                key={r.slug}
                onClick={() => setActiveRisk(r.slug)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  r.slug === activeRisk
                    ? "bg-frame-red/10 text-frame-red border border-frame-red/30"
                    : "text-ey-light-gray hover:text-white hover:bg-ey-dark-gray"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{r.name}</span>
                  <span className="text-xs opacity-70">{r.questions.length}</span>
                </div>
              </button>
            ))}
            {data.risks.length === 0 && (
              <p className="text-xs text-ey-sonic-silver px-3 py-2">
                No risks defined yet. Add them from Authoring Admin.
              </p>
            )}
            {data.unassigned.length > 0 && (
              <>
                <div className="border-t border-ey-sonic-silver/20 my-2" />
                <button
                  onClick={() => setActiveRisk("__unassigned__")}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeRisk === "__unassigned__"
                      ? "bg-ey-sonic-silver/20 text-ey-sonic-silver border border-ey-sonic-silver/40"
                      : "text-ey-sonic-silver/70 hover:text-ey-light-gray hover:bg-ey-dark-gray"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">Unassigned</span>
                    <span className="text-xs opacity-70">{data.unassigned.length}</span>
                  </div>
                </button>
              </>
            )}
          </div>
        </nav>

        {/* Questions for selected risk */}
        <div className="flex-1 space-y-4">
          {selectedBucket && (
            <>
              <div>
                <div className="flex items-center justify-between">
                  <SectionTitle>{selectedBucket.name}</SectionTitle>
                  <Badge>{selectedBucket.questions.length} questions</Badge>
                </div>
                {selectedBucket.description && (
                  <p className="text-ey-sonic-silver text-sm mt-1">
                    {selectedBucket.description}
                  </p>
                )}
              </div>
              <div className="space-y-3">
                {selectedBucket.questions.map((q) => (
                  <QuestionRow
                    key={q.id}
                    question={q}
                    showSection
                    sectionName={q.sectionName}
                  />
                ))}
                {selectedBucket.questions.length === 0 && (
                  <Card>
                    <p className="text-ey-sonic-silver text-center py-4">
                      No questions assigned to this risk yet.
                    </p>
                  </Card>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FoundationBlock({ questions }: { questions: CorpusQuestion[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <div>
          <h3 className="text-ey-yellow text-sm font-semibold">Foundation Questions</h3>
          <p className="text-ey-sonic-silver text-xs mt-0.5">
            Intake and triage questions — same regardless of risk or category view.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{questions.length}</Badge>
          <span className="text-ey-sonic-silver text-xs">{open ? "Collapse" : "Expand"}</span>
        </div>
      </button>
      {open && (
        <div className="mt-4 space-y-3">
          {questions.map((q) => (
            <QuestionRow key={q.id} question={q} showSection sectionName={q.sectionName} />
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Shared question row ──────────────────────────────────────────────────────

function QuestionRow({
  question,
  showSection,
  sectionName,
}: {
  question: {
    slug: string;
    prompt: string;
    answerType: string;
    required: boolean;
    aiPrepopulationPriority?: string;
    dependsOn?: { slug: string; rule: unknown }[];
    activates?: { slug: string; rule: unknown }[];
  };
  showSection?: boolean;
  sectionName?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const answerTypeColors: Record<string, string> = {
    boolean: "blue",
    single_select: "purple",
    multi_select: "purple",
    text_short: "default",
    text_long: "default",
    number: "blue",
    entity_ref: "orange",
    entity_ref_multi: "orange",
    url: "default",
    date: "default",
  };

  return (
    <Card className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-white text-sm font-medium">{question.prompt}</p>
            <p className="text-ey-sonic-silver text-xs font-mono mt-1">{question.slug}</p>
          </div>
          <div className="flex gap-2 ml-4 flex-shrink-0">
            {showSection && sectionName && <Badge>{sectionName}</Badge>}
            <Badge color={(answerTypeColors[question.answerType] || "default") as any}>
              {question.answerType}
            </Badge>
            {question.required && <Badge color="red">req</Badge>}
          </div>
        </div>

        {expanded && (
          <div className="pt-3 border-t border-ey-sonic-silver/20 space-y-2">
            {question.aiPrepopulationPriority && (
              <div className="flex gap-4 text-xs">
                <span className="text-ey-sonic-silver">
                  AI priority:{" "}
                  <span className="text-ey-light-gray">
                    {question.aiPrepopulationPriority}
                  </span>
                </span>
              </div>
            )}

            {question.dependsOn && question.dependsOn.length > 0 && (
              <div>
                <span className="text-xs text-ey-sonic-silver">Depends on:</span>
                <div className="flex gap-1 flex-wrap mt-1">
                  {question.dependsOn.map((dep, i) => (
                    <Badge key={i} color="orange">
                      {dep.slug}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {question.activates && question.activates.length > 0 && (
              <div>
                <span className="text-xs text-ey-sonic-silver">Activates:</span>
                <div className="flex gap-1 flex-wrap mt-1">
                  {question.activates.map((act, i) => (
                    <Badge key={i} color="green">
                      {act.slug}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
