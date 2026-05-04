export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/users — List users */
export async function GET() {
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(users);
}

/** POST /api/users — Create a user (no auth for V1) */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, name, globalRoles } = body;

  if (!email || !name) {
    return NextResponse.json({ error: "email and name are required" }, { status: 400 });
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, globalRoles: globalRoles || null },
    create: { email, name, globalRoles: globalRoles || null },
  });

  return NextResponse.json(user, { status: 201 });
}
