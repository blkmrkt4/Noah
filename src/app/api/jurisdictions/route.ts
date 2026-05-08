export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/jurisdictions
 *
 * Returns all regions with their member countries for the jurisdiction
 * picker. Countries without an assigned region are returned under an
 * "Unassigned" pseudo-region so they're never lost.
 */
export async function GET() {
  const [regions, jurisdictions] = await Promise.all([
    prisma.region.findMany({ orderBy: { displayOrder: "asc" } }),
    prisma.jurisdiction.findMany({ orderBy: { name: "asc" } }),
  ]);

  const byRegion = new Map<string | null, typeof jurisdictions>();
  for (const j of jurisdictions) {
    const k = j.regionId;
    if (!byRegion.has(k)) byRegion.set(k, []);
    byRegion.get(k)!.push(j);
  }

  const out = regions.map((r) => ({
    id: r.id,
    name: r.name,
    shortName: r.shortName,
    displayOrder: r.displayOrder,
    countries: (byRegion.get(r.id) ?? []).map((j) => ({
      id: j.id,
      code: j.code,
      name: j.name,
    })),
  }));

  const orphans = byRegion.get(null);
  if (orphans && orphans.length > 0) {
    out.push({
      id: "__unassigned",
      name: "Unassigned",
      shortName: "—",
      displayOrder: 9999,
      countries: orphans.map((j) => ({ id: j.id, code: j.code, name: j.name })),
    });
  }

  return NextResponse.json(out);
}
