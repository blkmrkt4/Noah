"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageTitle, Card, Button, Input, Select } from "@/components/ui";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [scopeType, setScopeType] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      // Ensure user exists
      const userRes = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ownerEmail, name: ownerName }),
      });
      const user = await userRes.json();

      // Create project
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          commercialOwnerId: user.id,
          scopeType,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create project");
      }

      const project = await res.json();
      router.push(`/projects/${project.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <PageTitle>New Attestation Project</PageTitle>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Project Name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Global Data Analytics Platform"
            required
            helpText="The product or asset being assessed."
          />

          <Select
            label="Deployment Scope"
            name="scopeType"
            value={scopeType}
            onChange={(e) => setScopeType(e.target.value)}
            required
            options={[
              { value: "single_country", label: "Single country" },
              { value: "multi_country", label: "Multi-country" },
              { value: "global", label: "Global" },
            ]}
          />

          <div className="border-t border-ey-sonic-silver/30 pt-6">
            <h3 className="text-ey-light-gray text-sm font-medium mb-4">
              Commercial Owner
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Name"
                name="ownerName"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Jane Smith"
                required
              />
              <Input
                label="Email"
                name="ownerEmail"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="jane.smith@ey.com"
                required
              />
            </div>
          </div>

          {error && (
            <div className="text-frame-red text-sm bg-frame-red/10 rounded-lg p-3">
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <a href="/">
              <Button variant="secondary">Cancel</Button>
            </a>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
