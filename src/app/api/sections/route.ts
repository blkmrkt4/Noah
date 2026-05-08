export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/sections — list all sections with the policies bound to them and a
 * count of currently active questions per section. Drives section pickers and
 * the Authoring → Questions rail.
 */
export async function GET() {
  const sections = await prisma.section.findMany({
    orderBy: { displayOrder: "asc" },
    include: {
      policyBindings: {
        include: {
          policyDoc: {
            include: {
              _count: { select: { versions: true } },
            },
          },
        },
      },
      _count: { select: { questions: true } },
    },
  });
  return NextResponse.json(sections);
}
