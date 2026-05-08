export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/policies/:id — update editable metadata (description, jurisdictionScope).
 * Title is intentionally not editable here; treat it as identity.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const data: {
    description?: string | null;
    jurisdictionScope?: unknown;
  } = {};
  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    data.description = body.description ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "jurisdictionScope")) {
    data.jurisdictionScope = body.jurisdictionScope;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  const updated = await prisma.policyDoc.update({
    where: { id },
    data: data as never,
  });
  return NextResponse.json(updated);
}

/** GET /api/policies/:id — full policy doc with versions and section bindings */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const doc = await prisma.policyDoc.findUnique({
    where: { id },
    include: {
      versions: { orderBy: { version: "desc" } },
      sectionBindings: {
        include: {
          section: { select: { id: true, slug: true, displayName: true } },
        },
      },
      _count: { select: { questionExclusions: true, versions: true } },
    },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(doc);
}

/**
 * DELETE /api/policies/:id — admin convenience.
 * Cascades versions, exclusions, and section bindings. Snapshots that pin
 * specific historical versions block deletion (a project may still rely on it).
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const snapshotCount = await prisma.policySnapshot.count({
    where: { policyVersion: { policyDocId: id } },
  });
  if (snapshotCount > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete: ${snapshotCount} project snapshot(s) reference this policy. Snapshots are immutable evidence.`,
      },
      { status: 409 }
    );
  }

  await prisma.$transaction([
    prisma.questionPolicyExclusion.deleteMany({ where: { policyDocId: id } }),
    prisma.policyDocSection.deleteMany({ where: { policyDocId: id } }),
    prisma.questionMoreInfo.updateMany({
      where: { sourcePolicy: { policyDocId: id } },
      data: { sourcePolicyVersionId: null },
    }),
    prisma.policyVersion.deleteMany({ where: { policyDocId: id } }),
    prisma.policyDoc.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
