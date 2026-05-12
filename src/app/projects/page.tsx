"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge, Button, Card, PageTitle, ProgressBar } from "@/components/ui";

type ProjectListItem = {
  id: string;
  name: string;
  createdAt: string;
  scopeType: string;
  repoUrl: string | null;
  repoLastScanAt: string | null;
  commercialOwner: { id: string; name: string; email: string };
  jurisdictions: { jurisdiction: { code: string; name: string } }[];
  sectionStates: { state: string; section: { slug: string; displayName: string } }[];
};

export default function ProjectsListPage() {
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data: ProjectListItem[]) => setProjects(data))
      .catch(() => setProjects(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-6 py-8 max-w-7xl space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <PageTitle>Cases</PageTitle>
          <p className="text-ey-light-gray text-sm -mt-4">
            Every product currently moving through the ART review.
          </p>
        </div>

        <Link href="/projects/new">
          <Button>New Case</Button>
        </Link>
      </div>

      {loading ? (
        <Card>
          <p className="text-ey-sonic-silver">Loading...</p>
        </Card>
      ) : projects === null ? (
        <Card>
          <p className="text-frame-red">Unable to load assets.</p>
        </Card>
      ) : projects.length === 0 ? (
        <EmptyState />
      ) : (
        <ProjectTable projects={projects} />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="py-16 text-center">
      <div className="mx-auto w-40 h-30 mb-6 flex items-center justify-center text-ey-sonic-silver">
        <svg
          width="160"
          height="120"
          viewBox="0 0 160 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <rect x="20" y="30" width="120" height="70" rx="6" stroke="currentColor" strokeWidth="2" />
          <path d="M20 50 H140" stroke="currentColor" strokeWidth="2" />
          <circle cx="32" cy="40" r="2" fill="currentColor" />
          <circle cx="40" cy="40" r="2" fill="currentColor" />
          <circle cx="48" cy="40" r="2" fill="currentColor" />
          <path d="M40 70 H120" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
          <path d="M40 82 H100" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
        </svg>
      </div>
      <h2 className="text-ey-yellow text-xl font-semibold mb-2">
        No cases yet
      </h2>
      <p className="text-ey-light-gray text-sm max-w-md mx-auto mb-6">
        Start one to put a product through the ART review. You&apos;ll connect
        a repo, drop in any case documents, then walk the questionnaire.
      </p>
      <Link href="/projects/new">
        <Button>Add a Case</Button>
      </Link>
    </Card>
  );
}

function ProjectTable({ projects }: { projects: ProjectListItem[] }) {
  const router = useRouter();
  return (
    <Card className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-black/35 text-ey-sonic-silver text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Case</th>
              <th className="text-left px-4 py-3 font-medium">Owner</th>
              <th className="text-left px-4 py-3 font-medium">Jurisdictions</th>
              <th className="text-left px-4 py-3 font-medium">Sections Cleared</th>
              <th className="text-left px-4 py-3 font-medium">Repo</th>
              <th className="text-left px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => {
              const cleared = project.sectionStates.filter((s) => s.state === "cleared").length;
              const total = project.sectionStates.length;
              const href = `/projects/${project.id}`;
              return (
                <tr
                  key={project.id}
                  onClick={() => router.push(href)}
                  className="border-t border-ey-sonic-silver/15 hover:bg-black/20 cursor-pointer"
                >
                  <td className="px-4 py-3 align-top">
                    <Link
                      href={href}
                      className="text-white font-medium hover:text-ey-yellow"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {project.name}
                    </Link>
                    <div className="text-ey-sonic-silver text-xs mt-1">
                      {project.scopeType.replace(/_/g, " ")}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="text-white">{project.commercialOwner.name}</div>
                    <div className="text-ey-sonic-silver text-xs">{project.commercialOwner.email}</div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="text-white">{project.jurisdictions.length}</div>
                    <div className="text-ey-sonic-silver text-xs truncate max-w-56">
                      {project.jurisdictions.slice(0, 3).map((j) => j.jurisdiction.code).join(", ")}
                      {project.jurisdictions.length > 3 ? ` +${project.jurisdictions.length - 3}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top min-w-40">
                    <ProgressBar value={cleared} max={total} />
                    <div className="text-ey-sonic-silver text-xs mt-1">
                      {cleared}/{total} cleared
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    {project.repoUrl ? (
                      <Badge color="green">Connected</Badge>
                    ) : (
                      <Badge color="default">Not connected</Badge>
                    )}
                    {project.repoLastScanAt && (
                      <div className="text-ey-sonic-silver text-xs mt-1">
                        Scanned {new Date(project.repoLastScanAt).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-ey-light-gray text-xs">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
