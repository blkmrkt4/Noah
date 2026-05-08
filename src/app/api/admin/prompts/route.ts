import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const prompts = await prisma.promptLibrary.findMany({ orderBy: { slug: "asc" } });
  return NextResponse.json(prompts);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { slug, name, description, systemPrompt, userPromptTemplate } = body;

  if (!slug || !name || !systemPrompt || !userPromptTemplate) {
    return NextResponse.json(
      { error: "slug, name, systemPrompt, and userPromptTemplate are required" },
      { status: 400 }
    );
  }

  const prompt = await prisma.promptLibrary.create({
    data: {
      slug,
      name,
      description: description ?? null,
      systemPrompt,
      userPromptTemplate,
    },
  });

  return NextResponse.json(prompt, { status: 201 });
}
