import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { slug, name, description, systemPrompt, userPromptTemplate } = body;

  const prompt = await prisma.promptLibrary.update({
    where: { id },
    data: {
      ...(slug !== undefined && { slug }),
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(systemPrompt !== undefined && { systemPrompt }),
      ...(userPromptTemplate !== undefined && { userPromptTemplate }),
    },
  });

  return NextResponse.json(prompt);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const inUse = await prisma.activityBind.count({ where: { promptId: id } });
  if (inUse > 0) {
    return NextResponse.json(
      { error: `Prompt is in use by ${inUse} bind(s). Reassign or delete those first.` },
      { status: 409 }
    );
  }
  await prisma.promptLibrary.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
