"use client";

import { useEffect, useState } from "react";
import { PageTitle, Card, Badge, SectionTitle } from "@/components/ui";

interface CorpusSection {
  id: string;
  slug: string;
  displayName: string;
  displayOrder: number;
  questions: {
    id: string;
    slug: string;
    prompt: string;
    answerType: string;
    options: { value: string; label: string }[] | null;
    helpText: string | null;
    required: boolean;
    aiPrepopulationPriority: string;
    dependsOn: { slug: string; rule: unknown }[];
    activates: { slug: string; rule: unknown }[];
  }[];
}

export default function CorpusPage() {
  const [sections, setSections] = useState<CorpusSection[]>([]);
  const [activeSection, setActiveSection] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="p-8 text-ey-sonic-silver">Loading corpus...</div>;

  const currentSection = sections.find((s) => s.slug === activeSection);
  const allQuestions = sections.flatMap((s) => s.questions.map((q) => ({ ...q, sectionSlug: s.slug, sectionName: s.displayName })));

  // Search across all questions
  const searchResults = searchTerm.length >= 2
    ? allQuestions.filter(
        (q) =>
          q.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.prompt.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : null;

  return (
    <div className="px-6 py-8 max-w-7xl">
      <PageTitle>Question Corpus</PageTitle>

      {/* Search */}
      <div className="mb-8">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search questions by slug or text..."
          className="w-full max-w-lg px-4 py-2 rounded-lg bg-black border border-ey-sonic-silver/50 text-white placeholder:text-ey-sonic-silver focus:outline-none focus:border-ey-yellow/50 text-sm"
        />
      </div>

      {/* Search Results */}
      {searchResults && (
        <div className="mb-8">
          <SectionTitle>
            Search Results ({searchResults.length})
          </SectionTitle>
          <div className="space-y-3">
            {searchResults.slice(0, 20).map((q) => (
              <QuestionRow key={q.id} question={q} showSection sectionName={q.sectionName} />
            ))}
            {searchResults.length === 0 && (
              <p className="text-ey-sonic-silver text-sm">No questions match your search.</p>
            )}
          </div>
        </div>
      )}

      {/* Section browser */}
      {!searchResults && (
        <div className="flex gap-6">
          {/* Section nav */}
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

          {/* Questions list */}
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
      )}
    </div>
  );
}

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
    aiPrepopulationPriority: string;
    dependsOn: { slug: string; rule: unknown }[];
    activates: { slug: string; rule: unknown }[];
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
            <div className="flex gap-4 text-xs">
              <span className="text-ey-sonic-silver">
                AI priority:{" "}
                <span className="text-ey-light-gray">{question.aiPrepopulationPriority}</span>
              </span>
            </div>

            {question.dependsOn.length > 0 && (
              <div>
                <span className="text-xs text-ey-sonic-silver">Depends on:</span>
                <div className="flex gap-1 flex-wrap mt-1">
                  {question.dependsOn.map((dep, i) => (
                    <Badge key={i} color="orange">{dep.slug}</Badge>
                  ))}
                </div>
              </div>
            )}

            {question.activates.length > 0 && (
              <div>
                <span className="text-xs text-ey-sonic-silver">Activates:</span>
                <div className="flex gap-1 flex-wrap mt-1">
                  {question.activates.map((act, i) => (
                    <Badge key={i} color="green">{act.slug}</Badge>
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
