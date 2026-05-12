"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { Badge, Button, Card, IconAlertTriangle, IconCalendar, IconClock, IconFileSearch, IconHourglass, IconLayers, IconMessageCircle, IconSend, IconShield, IconUsers, PageTitle, ProgressBar, SignalDot, StatusIndicator } from "@/components/ui";
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
    reviewerActivity: {
      reviewId: string;
      reviewerName: string;
      domain: string;
      sectionName: string | null;
      isCriticalPath: boolean;
      advisoryDeadline: string | null;
      signal: "red" | "yellow" | "green";
      lastAction: {
        type: "viewed" | "commented" | "clarification_opened" | "clarification_resolved" | "delegated" | "disposed" | "none";
        at: string | null;
      };
      disposition: string | null;
    }[];
  }[];
  attentionRequired: {
    staleCases14d: { id: string; name: string }[];
    untouchedQuestions: number;
    staleDelegations: number;
    ageBuckets: { over60: number; over90: number; over120: number };
  };
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
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load(attempt = 0) {
      try {
        const res = await fetch(`/api/dashboard?persona=${toApiPersona(persona)}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const payload: DashboardPayload = await res.json();
        if (!cancelled) setData(payload);
      } catch {
        // Retry once after a short delay
        if (attempt === 0 && !cancelled) {
          await new Promise((r) => setTimeout(r, 1000));
          return load(1);
        }
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [persona]);

  const generatedLabel = data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : "--";

  return (
    <div className="px-6 py-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <PageTitle>Dashboard</PageTitle>
          <p className="text-ey-light-gray text-sm -mt-4">
            Live approval operations across in-flight cases
          </p>
          <p className="text-ey-sonic-silver text-xs mt-2">Updated: {generatedLabel}</p>
        </div>

        <Link href="/projects/new">
          <Button>New Case</Button>
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
          <CasePortfolioTable
            projects={data.projects}
            expandedProjectId={expandedProjectId}
            onToggleExpand={(id) => setExpandedProjectId(expandedProjectId === id ? null : id)}
          />

          <AttentionRequired attention={data.attentionRequired} />
        </>
      )}
    </div>
  );
}

type ProjectRow = DashboardPayload["projects"][number];

function CasePortfolioTable({
  projects,
  expandedProjectId,
  onToggleExpand,
}: {
  projects: ProjectRow[];
  expandedProjectId: string | null;
  onToggleExpand: (id: string) => void;
}) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-ey-sonic-silver/20">
        <h2 className="text-white font-semibold">Case Portfolio</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="bg-black/35 text-ey-sonic-silver text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 font-medium w-8"></th>
              <th className="text-left px-4 py-3 font-medium">Case</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Signals</th>
              <th className="text-left px-4 py-3 font-medium">Responders</th>
              <th className="text-left px-4 py-3 font-medium">Review Load</th>
              <th className="text-left px-4 py-3 font-medium">Sections</th>
              <th className="text-left px-4 py-3 font-medium">Last Activity</th>
              <th className="text-left px-4 py-3 font-medium">Risk</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-ey-sonic-silver text-sm">
                  No active cases.
                </td>
              </tr>
            ) : (
              projects.map((project) => {
                const isExpanded = expandedProjectId === project.id;
                const worstSignal = project.reviewerActivity.reduce<"green" | "yellow" | "red">(
                  (worst, r) => {
                    if (r.signal === "red") return "red";
                    if (r.signal === "yellow" && worst !== "red") return "yellow";
                    return worst;
                  },
                  "green"
                );

                return (
                  <React.Fragment key={project.id}>
                    <tr
                      className={`border-t border-ey-sonic-silver/40 hover:bg-black/20 cursor-pointer ${isExpanded ? "bg-black/20" : ""}`}
                      onClick={() => onToggleExpand(project.id)}
                    >
                      <td className="px-4 py-3 align-top text-ey-sonic-silver text-xs">
                        {isExpanded ? "\u25BC" : "\u25B6"}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <a
                          href={`/projects/${project.id}`}
                          className="text-white font-medium hover:text-ey-yellow"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {project.name}
                        </a>
                        <div className="text-ey-sonic-silver text-xs mt-1">Owner: {project.owner.name}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <StatusIndicator status={project.status} />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-1.5">
                          <SignalDot signal={worstSignal} size="md" />
                          <span className="text-xs text-ey-light-gray">
                            {project.reviewerActivity.filter((r) => r.signal === "red").length > 0
                              ? `${project.reviewerActivity.filter((r) => r.signal === "red").length} blocking`
                              : project.reviewerActivity.filter((r) => r.signal === "yellow").length > 0
                                ? `${project.reviewerActivity.filter((r) => r.signal === "yellow").length} pending`
                                : "all clear"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-1.5 text-white">
                          <span className="text-frame-blue"><IconUsers /></span>
                          {project.engagedResponders}/{project.expectedResponders}
                        </div>
                        <div className="text-ey-sonic-silver text-xs pl-[18px]">
                          {Math.round(
                            project.expectedResponders > 0
                              ? (project.engagedResponders / project.expectedResponders) * 100
                              : 0
                          )}
                          % engaged
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-1.5 text-white">
                          <span className="text-frame-purple"><IconFileSearch /></span>
                          {project.openReviews} open
                        </div>
                        <div className="flex items-center gap-1.5 text-ey-sonic-silver text-xs">
                          <span className="text-frame-orange"><IconMessageCircle /></span>
                          {project.openClarifications} clarifications
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top min-w-40">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-ey-yellow"><IconLayers /></span>
                          <ProgressBar value={project.clearedSections} max={project.totalSections} />
                        </div>
                        <div className="text-ey-sonic-silver text-xs pl-[18px]">
                          {project.underReviewSections} under review, {project.overdueSectionCount} overdue
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {(() => {
                          const daysAgo = Math.floor((Date.now() - new Date(project.lastActivityAt).getTime()) / (1000 * 60 * 60 * 24));
                          const urgencyColor = daysAgo >= 14 ? "text-frame-red" : daysAgo >= 7 ? "text-frame-orange" : "text-white";
                          return (
                            <>
                              <div className={`flex items-center gap-1.5 text-sm font-medium ${urgencyColor}`}>
                                <span className={daysAgo >= 14 ? "text-frame-red" : daysAgo >= 7 ? "text-frame-orange" : "text-frame-blue"}><IconClock /></span>
                                {timeAgo(project.lastActivityAt)}
                              </div>
                              <div className="text-ey-sonic-silver text-[11px] pl-[18px]">
                                {new Date(project.lastActivityAt).toLocaleDateString()}
                              </div>
                            </>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-1.5">
                          <span className={project.riskLevel === "high" ? "text-frame-red" : project.riskLevel === "medium" ? "text-frame-orange" : "text-frame-green"}>
                            <IconShield />
                          </span>
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
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={9} className="bg-black/30 px-6 py-4 border-t border-ey-sonic-silver/10">
                          <ReviewerActivityPanel activity={project.reviewerActivity} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

type ReviewerActivityEntry = DashboardPayload["projects"][number]["reviewerActivity"][number];

const ACTION_LABELS: Record<ReviewerActivityEntry["lastAction"]["type"], string> = {
  viewed: "Viewed",
  commented: "Commented",
  clarification_opened: "Asked for clarification",
  clarification_resolved: "Clarification resolved",
  delegated: "Delegated",
  disposed: "Signed off",
  none: "No activity",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type AttentionData = DashboardPayload["attentionRequired"];

function AttentionRequired({ attention }: { attention: AttentionData }) {
  const items: { icon: React.ReactNode; color: string; count: number; label: string; detail?: React.ReactNode }[] = [
    {
      icon: <IconAlertTriangle />,
      color: "text-frame-red",
      count: attention.staleCases14d.length,
      label: "cases not touched by any reviewer in 2+ weeks",
      detail: attention.staleCases14d.length > 0 ? (
        <div className="flex flex-wrap gap-1 mt-1">
          {attention.staleCases14d.map((c) => (
            <a key={c.id} href={`/projects/${c.id}`} className="text-ey-yellow text-[11px] hover:underline">{c.name}</a>
          ))}
        </div>
      ) : undefined,
    },
    {
      icon: <IconMessageCircle />,
      color: "text-frame-orange",
      count: attention.untouchedQuestions,
      label: "questions with no comments and no sign-off by any reviewer",
    },
    {
      icon: <IconSend />,
      color: "text-frame-orange",
      count: attention.staleDelegations,
      label: "delegations sent 1+ week ago with no response",
    },
    {
      icon: <IconCalendar />,
      color: attention.ageBuckets.over120 > 0 ? "text-frame-red" : "text-ey-yellow",
      count: attention.ageBuckets.over60,
      label: "cases in process 60+ days",
      detail: (
        <div className="text-ey-sonic-silver text-[11px] mt-0.5">
          {attention.ageBuckets.over90 > 0 && <span className="text-frame-orange mr-3">{attention.ageBuckets.over90} over 90d</span>}
          {attention.ageBuckets.over120 > 0 && <span className="text-frame-red">{attention.ageBuckets.over120} over 120d</span>}
        </div>
      ),
    },
  ];

  const totalIssues = items.reduce((sum, i) => sum + i.count, 0);
  if (totalIssues === 0) return null;

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-ey-sonic-silver/20 flex items-center gap-2">
        <span className="text-frame-red"><IconAlertTriangle /></span>
        <h2 className="text-white font-semibold">Attention Required</h2>
      </div>
      <div className="divide-y divide-ey-sonic-silver/20">
        {items.map((item, i) => (
          <div key={i} className="px-5 py-4 flex items-center gap-4">
            <div className="flex items-center gap-3 min-w-[80px]">
              <span className={item.color}>{item.icon}</span>
              <span className={`text-5xl font-bold ${item.count > 0 ? item.color : "text-ey-sonic-silver"}`}>
                {item.count}
              </span>
            </div>
            <div className="flex-1">
              <div className="text-ey-light-gray text-lg">{item.label}</div>
              {item.count > 0 && item.detail}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function deadlineLabel(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "overdue";
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return `${days}d remaining`;
}

function ReviewerActivityPanel({
  activity,
}: {
  activity: ReviewerActivityEntry[];
}) {
  // Group by section (null section grouped as "Project-wide")
  const grouped = new Map<string, ReviewerActivityEntry[]>();
  for (const entry of activity) {
    const key = entry.sectionName ?? "Project-wide";
    const list = grouped.get(key) ?? [];
    list.push(entry);
    grouped.set(key, list);
  }

  if (activity.length === 0) {
    return <p className="text-ey-sonic-silver text-xs">No reviews assigned yet.</p>;
  }

  return (
    <div className="space-y-4">
      {[...grouped.entries()].map(([sectionName, entries]) => (
        <div key={sectionName}>
          <h4 className="text-ey-light-gray text-xs font-semibold uppercase tracking-wide mb-2">
            {sectionName}
          </h4>
          <div className="grid gap-2">
            {entries.map((entry) => (
              <div
                key={entry.reviewId}
                className="flex items-center gap-3 bg-black/20 rounded px-3 py-2"
              >
                <SignalDot signal={entry.signal} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-xs font-medium truncate">
                      {entry.reviewerName}
                    </span>
                    <Badge color="blue">{entry.domain}</Badge>
                    {entry.isCriticalPath ? (
                      <Badge color="red">critical</Badge>
                    ) : (
                      <Badge color="yellow">advisory</Badge>
                    )}
                    {entry.disposition && (
                      <Badge
                        color={
                          entry.disposition === "approve"
                            ? "green"
                            : entry.disposition === "reject"
                              ? "red"
                              : "orange"
                        }
                      >
                        {entry.disposition}
                      </Badge>
                    )}
                  </div>
                  <div className="text-ey-sonic-silver text-[11px] mt-0.5">
                    {ACTION_LABELS[entry.lastAction.type]}
                    {entry.lastAction.at && ` \u2022 ${timeAgo(entry.lastAction.at)}`}
                    {!entry.isCriticalPath && entry.advisoryDeadline && (
                      <span className="ml-2 text-ey-yellow">
                        Deadline: {deadlineLabel(entry.advisoryDeadline)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
