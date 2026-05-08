import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { openrouterModelId, name, description, temperature, maxTokens } = body;

  const model = await prisma.modelLibrary.update({
    where: { id },
    data: {
      ...(openrouterModelId !== undefined && { openrouterModelId }),
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(temperature !== undefined && { temperature }),
      ...(maxTokens !== undefined && { maxTokens }),
    },
  });

  return NextResponse.json(model);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const inUse = await prisma.activityBind.count({ where: { modelId: id } });
  if (inUse > 0) {
    return NextResponse.json(
      { error: `Model is in use by ${inUse} bind(s). Reassign or delete those first.` },
      { status: 409 }
    );
  }
  await prisma.modelLibrary.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
