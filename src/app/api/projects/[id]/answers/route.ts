import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveQuestions } from "@/lib/activation-engine";

/** GET /api/projects/:id/answers — Get all answers with active question context */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const { activeQuestionVersionIds } = await getActiveQuestions(projectId);

  // Get all latest question versions with their answers for this project
  const versions = await prisma.questionVersion.findMany({
    orderBy: { version: "desc" },
    distinct: ["questionId"],
    include: {
      question: { include: { section: true } },
      answers: {
        where: { projectId },
      },
    },
  });

  const result = versions.map((v) => ({
    questionVersionId: v.id,
    slug: v.question.slug,
    section: v.question.section.slug,
    sectionName: v.question.section.displayName,
    prompt: v.prompt,
    answerType: v.answerType,
    options: v.options,
    helpText: v.helpText,
    required: v.required,
    isActive: activeQuestionVersionIds.includes(v.id),
    answer: v.answers[0] || null,
  }));

  return NextResponse.json(result);
}

/** POST /api/projects/:id/answers — Submit or update an answer */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const body = await req.json();
  const { questionVersionId, value, source, attestedBy } = body;

  if (!questionVersionId || value === undefined || !source) {
    return NextResponse.json(
      { error: "questionVersionId, value, and source are required" },
      { status: 400 }
    );
  }

  // Check if the question is active
  const { activeQuestionVersionIds } = await getActiveQuestions(projectId);
  if (!activeQuestionVersionIds.includes(questionVersionId)) {
    return NextResponse.json(
      { error: "Question is not currently active based on dependency rules" },
      { status: 400 }
    );
  }

  // Upsert the answer
  const answer = await prisma.answer.upsert({
    where: {
      projectId_questionVersionId: { projectId, questionVersionId },
    },
    update: {
      value,
      source,
      attestedBy: attestedBy || null,
      answeredAt: new Date(),
    },
    create: {
      projectId,
      questionVersionId,
      value,
      source,
      attestedBy: attestedBy || null,
    },
    include: {
      questionVersion: { include: { question: true } },
    },
  });

  // If this is an owner attestation over a system-inferred value, check for discrepancy
  if (source === "owner_attested") {
    const existing = await prisma.answer.findFirst({
      where: {
        projectId,
        questionVersionId,
        source: "system_inferred",
      },
    });

    if (existing && JSON.stringify(existing.value) !== JSON.stringify(value)) {
      await prisma.discrepancy.create({
        data: {
          answerId: answer.id,
          projectId,
          ownerValue: value,
          systemValue: existing.value || {},
          sourceCitation: existing.citation,
          severity: "medium", // Could be computed based on question risk weight
        },
      });
    }
  }

  return NextResponse.json(answer);
}
