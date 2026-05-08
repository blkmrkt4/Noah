"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, Card, PageTitle, ProgressBar, StatusIndicator } from "@/components/ui";
import { usePersona, type Persona } from "@/components/PersonaContext";

// The dashboard API still uses an older persona vocabulary. Map the workspace
// persona onto whichever bucket the API understands. Section Lead and Question
// Collaborator both flatten to "collaborator" until the API grows finer grain.
type ApiPersona = "commercial_owner" | "reviewer" | "collaborator" | "question_author";
function toApiPersona(p: Persona): ApiPersona {
  switch (p) {
    case "commercial_owner":
      return "commercial_owner";
    case "reviewer":
      return "reviewer";
    case "section_lead":
    case "question_collaborator":
      return "collaborator";
  }
}

type DashboardPayload = {
  persona: ApiPersona;
  generatedAt: string;
  summary: {
    inProgressProjects: number;
    awaitingOwner: number;
    awaitingReviewer: number;
    atRisk: number;
    medianReviewCycleHours: number;
  };
  projects: {
    id: string;
    name: string;
    status: string;
    owner: { id: string; name: string };
    jurisdictionCount: number;
    jurisdictions: { code: string; name: string }[];
    expectedResponders: number;
    engagedResponders: number;
    respondedReviews: number;
    openReviews: number;
    openClarifications: number;
    sectionCompletion: number;
    clearedSections: number;
    totalSections: number;
    underReviewSections: number;
    overdueSectionCount: number;
    oldestOpenReviewHours: number;
    riskLevel: "low" | "medium" | "high";
    riskScore: number;
    lastActivityAt: string;
  }[];
  bottlenecks: {
    sections: {
      section: string;
      drafting: number;
      released: number;
      underReview: number;
      cleared: number;
      overdue: number;
      pressure: number;
    }[];
    jurisdictions: {
      jurisdiction: string;
      projects: number;
      withReviewerCoverage: number;
      coveragePct: number;
    }[];
  };
  activity: {
    timestamp: string;
    projectId: string;
    projectName: string;
    type: string;
    message: string;
  }[];
  notes: {
    viewTracking: string;
    staleReviewThresholdHours: number;
  };
};

export default function Home() {
  const { persona } = usePersona();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard?persona=${toApiPersona(persona)}`)
      .then((res) => res.json())
      .then((payload: DashboardPayload) => setData(payload))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [persona]);

  const generatedLabel = data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : "--";

  return (
    <div className="px-6 py-8 max-w-7xl space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <PageTitle>Dashboard</PageTitle>
          <p className="text-ey-light-gray text-sm -mt-4">
            Live approval operations across in-flight projects
          </p>
          <p className="text-ey-sonic-silver text-xs mt-2">Updated: {generatedLabel}</p>
        </div>

        <Link href="/projects/new">
          <Button>New Project</Button>
        </Link>
      </div>

      {loading ? (
        <Card>
          <p className="text-ey-sonic-silver">Loading dashboard...</p>
        </Card>
      ) : !data ? (
        <Card>
          <p className="text-frame-red">Unable to load dashboard data.</p>
        </Card>
      ) : (
        <>
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <SummaryCard label="In Progress" value={`${data.summary.inProgressProjects}`} accent="yellow" />
            <SummaryCard label="Awaiting Owner" value={`${data.summary.awaitingOwner}`} accent="orange" />
            <SummaryCard label="Awaiting Reviewer" value={`${data.summary.awaitingReviewer}`} accent="blue" />
            <SummaryCard label="At Risk" value={`${data.summary.atRisk}`} accent="red" />
            <SummaryCard
              label="Median Review Cycle"
              value={
                data.summary.medianReviewCycleHours > 0
                  ? `${data.summary.medianReviewCycleHours}h`
                  : "No data"
              }
              accent="green"
            />
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <Card className="p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-ey-sonic-silver/20">
                  <h2 className="text-white font-semibold">Project Portfolio</h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] text-sm">
                    <thead className="bg-black/35 text-ey-sonic-silver text-xs uppercase tracking-wide">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium">Project</th>
                        <th className="text-left px-4 py-3 font-medium">Status</th>
                        <th className="text-left px-4 py-3 font-medium">Jurisdictions</th>
                        <th className="text-left px-4 py-3 font-medium">Responders</th>
                        <th className="text-left px-4 py-3 font-medium">Review Load</th>
                        <th className="text-left px-4 py-3 font-medium">Sections</th>
                        <th className="text-left px-4 py-3 font-medium">Last Activity</th>
                        <th className="text-left px-4 py-3 font-medium">Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.projects.map((project) => (
                        <tr key={project.id} className="border-t border-ey-sonic-silver/15 hover:bg-black/20">
                          <td className="px-4 py-3 align-top">
                            <a href={`/projects/${project.id}`} className="text-white font-medium hover:text-ey-yellow">
                              {project.name}
                            </a>
                            <div className="text-ey-sonic-silver text-xs mt-1">Owner: {project.owner.name}</div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <StatusIndicator status={project.status} />
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="text-white">{project.jurisdictionCount}</div>
                            <div className="text-ey-sonic-silver text-xs truncate max-w-56">
                              {project.jurisdictions.slice(0, 3).map((j) => j.code).join(", ")}
                              {project.jurisdictions.length > 3 ? ` +${project.jurisdictions.length - 3}` : ""}
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="text-white">
                              {project.engagedResponders}/{project.expectedResponders}
                            </div>
                            <div className="text-ey-sonic-silver text-xs">
                              {Math.round(
                                project.expectedResponders > 0
                                  ? (project.engagedResponders / project.expectedResponders) * 100
                                  : 0
                              )}
                              % engaged
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="text-white">{project.openReviews} open</div>
                            <div className="text-ey-sonic-silver text-xs">
                              {project.openClarifications} clarifications
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top min-w-40">
                            <ProgressBar value={project.clearedSections} max={project.totalSections} />
                            <div className="text-ey-sonic-silver text-xs mt-1">
                              {project.underReviewSections} under review, {project.overdueSectionCount} overdue
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top text-ey-light-gray text-xs">
                            {new Date(project.lastActivityAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <Badge
                              color={
                                project.riskLevel === "high"
                                  ? "red"
                                  : project.riskLevel === "medium"
                                    ? "orange"
                                    : "green"
                              }
                            >
                              {project.riskLevel}
                            </Badge>
                            {project.oldestOpenReviewHours > 0 && (
                              <div className="text-ey-sonic-silver text-xs mt-1">
                                oldest open: {project.oldestOpenReviewHours}h
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <h3 className="text-white font-semibold mb-3">Section Pressure</h3>
                <div className="space-y-3">
                  {data.bottlenecks.sections.slice(0, 5).map((section) => (
                    <div key={section.section}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-ey-light-gray truncate">{section.section}</span>
                        <span className="text-ey-sonic-silver">P{section.pressure}</span>
                      </div>
                      <ProgressBar value={section.underReview + section.overdue} max={Math.max(1, section.drafting + section.released + section.underReview + section.cleared)} />
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <h3 className="text-white font-semibold mb-3">Jurisdiction Coverage</h3>
                <div className="space-y-2">
                  {data.bottlenecks.jurisdictions.slice(0, 6).map((item) => (
                    <div key={item.jurisdiction} className="flex items-center justify-between text-xs">
                      <span className="text-ey-light-gray truncate mr-2">{item.jurisdiction}</span>
                      <span className="text-white">{item.coveragePct}%</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <h3 className="text-white font-semibold mb-3">Recent Workflow Activity</h3>
                <div className="space-y-3 max-h-80 overflow-auto pr-1">
                  {data.activity.slice(0, 12).map((event, idx) => (
                    <div key={`${event.projectId}-${event.timestamp}-${idx}`} className="border-l border-ey-sonic-silver/20 pl-3">
                      <div className="text-white text-xs">{event.message}</div>
                      <a href={`/projects/${event.projectId}`} className="text-ey-yellow text-xs hover:underline">
                        {event.projectName}
                      </a>
                      <div className="text-ey-sonic-silver text-[11px]">
                        {new Date(event.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </section>

          <Card>
            <p className="text-ey-sonic-silver text-xs">{data.notes.viewTracking}</p>
          </Card>
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "yellow" | "orange" | "blue" | "red" | "green";
}) {
  const colorClass =
    accent === "yellow"
      ? "text-ey-yellow"
      : accent === "orange"
        ? "text-frame-orange"
        : accent === "blue"
          ? "text-frame-blue"
          : accent === "red"
            ? "text-frame-red"
            : "text-frame-green";

  return (
    <Card>
      <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
      <div className="text-ey-light-gray text-xs uppercase tracking-wide mt-1">{label}</div>
    </Card>
  );
}
