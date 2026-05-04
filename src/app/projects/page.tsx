"use client";

import { useEffect, useState } from "react";
import { PageTitle, Card, Badge, Button, StatusIndicator } from "@/components/ui";

interface Project {
  id: string;
  name: string;
  status: string;
  scopeType: string;
  createdAt: string;
  submittedAt: string | null;
  commercialOwner: { name: string; email: string };
  sectionStates: { section: { displayName: string; slug: string }; state: string }[];
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then(setProjects)
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <PageTitle>Projects</PageTitle>
        <a href="/projects/new">
          <Button>New Project</Button>
        </a>
      </div>

      {loading ? (
        <div className="text-ey-sonic-silver">Loading...</div>
      ) : projects.length === 0 ? (
        <Card>
          <p className="text-ey-light-gray text-center py-8">
            No projects yet. Create your first attestation to get started.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {projects.map((project) => (
            <a
              key={project.id}
              href={`/projects/${project.id}`}
              className="block"
            >
              <Card className="hover:border-ey-yellow/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-white font-semibold text-lg mb-1">
                      {project.name}
                    </h3>
                    <p className="text-ey-sonic-silver text-sm mb-3">
                      Owner: {project.commercialOwner.name} &middot;{" "}
                      {new Date(project.createdAt).toLocaleDateString()}
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <Badge color="yellow">{project.scopeType.replace("_", " ")}</Badge>
                      <StatusIndicator status={project.status} />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-ey-sonic-silver mb-2">Sections</div>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {project.sectionStates.slice(0, 6).map((ss) => (
                        <Badge
                          key={ss.section.slug}
                          color={
                            ss.state === "cleared"
                              ? "green"
                              : ss.state === "under_review"
                              ? "orange"
                              : ss.state === "released"
                              ? "blue"
                              : "default"
                          }
                        >
                          {ss.section.slug}
                        </Badge>
                      ))}
                      {project.sectionStates.length > 6 && (
                        <Badge>+{project.sectionStates.length - 6}</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
