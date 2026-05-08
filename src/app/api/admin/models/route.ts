import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const models = await prisma.modelLibrary.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(models);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { openrouterModelId, name, description, temperature, maxTokens } = body;

  if (!openrouterModelId || !name) {
    return NextResponse.json(
      { error: "openrouterModelId and name are required" },
      { status: 400 }
    );
  }

  const model = await prisma.modelLibrary.create({
    data: {
      openrouterModelId,
      name,
      description: description ?? null,
      temperature: typeof temperature === "number" ? temperature : 0.2,
      maxTokens: typeof maxTokens === "number" ? maxTokens : 4096,
    },
  });

  return NextResponse.json(model, { status: 201 });
}
