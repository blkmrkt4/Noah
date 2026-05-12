"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageTitle, Card, Button, Input } from "@/components/ui";
import {
  JurisdictionPicker,
  summarizeScope,
  type JurisdictionScope,
} from "@/components/JurisdictionPicker";

interface Region {
  id: string;
  countries: { id: string; code: string; name: string }[];
}

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [scope, setScope] = useState<JurisdictionScope>(null);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [regions, setRegions] = useState<Region[] | null>(null);

  // Fetch the jurisdiction directory once so we can map picker codes back to
  // the IDs the API expects.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/jurisdictions")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setRegions(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setRegions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // code -> id lookup, built once regions land.
  const codeToId = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of regions ?? []) {
      for (const c of r.countries) map.set(c.code, c.id);
    }
    return map;
  }, [regions]);

  // Derive the persisted shape from the picker's user-facing modes.
  // - Global              → scopeType=global,        mode=include, ids=[]
  // - Specific (1)        → scopeType=single_country, mode=include, ids=[…]
  // - Specific (2+)       → scopeType=multi_country,  mode=include, ids=[…]
  // - Global except (any) → scopeType=global,        mode=exclude, ids=[…]
  const derived = useMemo(() => {
    if (!scope) {
      return {
        scopeType: "global" as const,
        jurisdictionMode: "include" as const,
        jurisdictionIds: [] as string[],
      };
    }
    const ids = scope.codes
      .map((c) => codeToId.get(c))
      .filter((v): v is string => Boolean(v));
    if (scope.mode === "exclude") {
      return {
        scopeType: "global" as const,
        jurisdictionMode: "exclude" as const,
        jurisdictionIds: ids,
      };
    }
    return {
      scopeType:
        ids.length <= 1 ? ("single_country" as const) : ("multi_country" as const),
      jurisdictionMode: "include" as const,
      jurisdictionIds: ids,
    };
  }, [scope, codeToId]);

  // Block submit until the picker's choice is internally consistent.
  const scopeReady =
    !scope ||
    scope.codes.length > 0 ||
    scope.mode === "exclude"; // exclude with 0 codes == global, allowed

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const userRes = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ownerEmail, name: ownerName }),
      });
      const user = await userRes.json();

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          commercialOwnerId: user.id,
          scopeType: derived.scopeType,
          jurisdictionMode: derived.jurisdictionMode,
          jurisdictionIds: derived.jurisdictionIds,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create case");
      }

      const project = await res.json();
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <PageTitle>New Attestation Case</PageTitle>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Case Name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Global Data Analytics Platform"
            required
            helpText="The product or asset being assessed."
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-ey-light-gray">
              Deployment Scope
              <span className="text-frame-red ml-1">*</span>
            </label>
            <JurisdictionPicker value={scope} onChange={setScope} />
            <p className="text-xs text-ey-sonic-silver">
              Current scope: <span className="text-ey-light-gray">{summarizeScope(scope)}</span>
            </p>
          </div>

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
            <Link href="/projects">
              <Button variant="secondary">Cancel</Button>
            </Link>
            <Button type="submit" disabled={submitting || !scopeReady}>
              {submitting ? "Creating..." : "Create Case"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
