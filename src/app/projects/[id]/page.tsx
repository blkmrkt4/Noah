"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  PageTitle,
  Card,
  Badge,
  Button,
  StatusIndicator,
  ProgressBar,
  SectionTitle,
} from "@/components/ui";

interface Project {
  id: string;
  name: string;
  status: string;
  scopeType: string;
  createdAt: string;
  commercialOwner: { name: string; email: string };
  sectionStates: { id: string; section: { id: string; slug: string; displayName: string; displayOrder: number }; state: string }[];
  answers: { id: string; questionVersion: { question: { section: { slug: string } } } }[];
  documents: { id: string; filename: string; extractions: unknown[] }[];
  patternMatches: { fitScore: number; patternVersion: { pattern: { name: string } } }[];
  reviews: { id: string; domain: string; status: string; disposition: string | null }[];
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => r.json())
      .then(setProject)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-ey-sonic-silver">Loading...</div>;
  if (!project) return <div className="p-8 text-frame-red">Project not found</div>;

  const answeredCount = project.answers.length;
  const sectionStates = project.sectionStates.sort(
    (a, b) => a.section.displayOrder - b.section.displayOrder
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <PageTitle>{project.name}</PageTitle>
          <div className="flex items-center gap-4 text-sm text-ey-sonic-silver">
            <span>Owner: {project.commercialOwner.name}</span>
            <StatusIndicator status={project.status} />
            <Badge color="yellow">{project.scopeType.replace("_", " ")}</Badge>
          </div>
        </div>
        <div className="flex gap-3">
          <a href={`/projects/${id}/questionnaire`}>
            <Button>Open Questionnaire</Button>
          </a>
          {project.status === "drafting" && (
            <Button
              variant="secondary"
              onClick={async () => {
                const res = await fetch(`/api/projects/${id}/submit`, { method: "POST" });
                if (res.ok) window.location.reload();
              }}
            >
              Submit for Review
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Sections */}
        <div className="lg:col-span-2 space-y-6">
          <SectionTitle>Sections</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sectionStates.map((ss) => {
              const sectionAnswers = project.answers.filter(
                (a) => a.questionVersion.question.section.slug === ss.section.slug
              );
              return (
                <Card key={ss.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-medium text-sm">
                      {ss.section.displayName}
                    </h3>
                    <StatusIndicator status={ss.state} />
                  </div>
                  <ProgressBar
                    value={sectionAnswers.length}
                    max={sectionAnswers.length + 5} // approximation
                    label="Answers"
                  />
                </Card>
              );
            })}
          </div>

          {/* Reviews */}
          {project.reviews.length > 0 && (
            <>
              <SectionTitle>Reviews</SectionTitle>
              <div className="space-y-3">
                {project.reviews.map((review) => (
                  <Card key={review.id}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge color="purple">{review.domain}</Badge>
                        <StatusIndicator status={review.status} />
                      </div>
                      {review.disposition && (
                        <Badge
                          color={
                            review.disposition === "approve"
                              ? "green"
                              : review.disposition === "reject"
                              ? "red"
                              : "orange"
                          }
                        >
                          {review.disposition}
                        </Badge>
                      )}
                      <a href={`/projects/${id}/review?reviewId=${review.id}`}>
                        <Button variant="secondary">View</Button>
                      </a>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card>
            <h3 className="text-ey-yellow text-sm font-semibold mb-4">Progress</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-ey-light-gray">Answers</span>
                <span className="text-white font-medium">{answeredCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ey-light-gray">Documents</span>
                <span className="text-white font-medium">{project.documents.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ey-light-gray">Reviews</span>
                <span className="text-white font-medium">{project.reviews.length}</span>
              </div>
            </div>
          </Card>

          {/* Pattern Matches */}
          {project.patternMatches.length > 0 && (
            <Card>
              <h3 className="text-ey-yellow text-sm font-semibold mb-4">
                Pattern Matches
              </h3>
              <div className="space-y-2">
                {project.patternMatches.map((pm, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-ey-light-gray truncate mr-2">
                        {pm.patternVersion.pattern.name}
                      </span>
                      <span className="text-white">
                        {Math.round(pm.fitScore * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-black rounded-full">
                      <div
                        className={`h-full rounded-full ${
                          pm.fitScore >= 1
                            ? "bg-frame-green"
                            : pm.fitScore >= 0.8
                            ? "bg-frame-orange"
                            : "bg-ey-sonic-silver"
                        }`}
                        style={{ width: `${pm.fitScore * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Documents */}
          <Card>
            <h3 className="text-ey-yellow text-sm font-semibold mb-4">Documents</h3>
            {project.documents.length === 0 ? (
              <p className="text-xs text-ey-sonic-silver">No documents uploaded yet.</p>
            ) : (
              <div className="space-y-2">
                {project.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-2 text-xs text-ey-light-gray"
                  >
                    <span className="truncate">{doc.filename}</span>
                    {doc.extractions.length > 0 && (
                      <Badge color="green">extracted</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
