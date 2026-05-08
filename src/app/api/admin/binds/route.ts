import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const binds = await prisma.activityBind.findMany({
    include: { model: true, prompt: true },
    orderBy: { slug: "asc" },
  });
  return NextResponse.json(binds);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { slug, name, modelId, promptId } = body;

  if (!slug || !name || !modelId || !promptId) {
    return NextResponse.json(
      { error: "slug, name, modelId, and promptId are required" },
      { status: 400 }
    );
  }

  const bind = await prisma.activityBind.upsert({
    where: { slug },
    create: { slug, name, modelId, promptId },
    update: { name, modelId, promptId },
    include: { model: true, prompt: true },
  });

  return NextResponse.json(bind);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "slug query param required" }, { status: 400 });
  }
  await prisma.activityBind.delete({ where: { slug } });
  return NextResponse.json({ ok: true });
}
