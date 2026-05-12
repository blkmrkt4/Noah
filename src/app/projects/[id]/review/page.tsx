"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { PageTitle, Card, Badge, Button, SectionTitle, StatusIndicator } from "@/components/ui";

interface Review {
  id: string;
  domain: string;
  status: string;
  disposition: string | null;
  dispositionNotes: string | null;
  project: { id: string; name: string };
  section: { displayName: string; slug: string } | null;
  reviewer: { user: { name: string } };
  clarifications: {
    id: string;
    status: string;
    answer: { id: string; value: unknown; questionVersion: { question: { slug: string }; prompt: string } };
    threads: { id: string; comments: { id: string; body: string; author: { name: string }; createdAt: string }[] }[];
  }[];
  threads: { id: string; comments: { id: string; body: string; author: { name: string }; createdAt: string }[] }[];
}

export default function ReviewPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const reviewId = searchParams.get("reviewId");
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [dispositionValue, setDispositionValue] = useState("");
  const [dispositionNotes, setDispositionNotes] = useState("");
  const [clarificationMessage, setClarificationMessage] = useState("");

  useEffect(() => {
    if (reviewId) {
      fetch(`/api/reviews/${reviewId}`)
        .then((r) => r.json())
        .then(setReview)
        .catch(() => null)
        .finally(() => setLoading(false));

      // Record that the reviewer has viewed this review
      fetch(`/api/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "view" }),
      }).catch(() => {});
    } else {
      setLoading(false);
    }
  }, [reviewId]);

  async function issueDisposition() {
    if (!reviewId || !dispositionValue) return;
    const res = await fetch(`/api/reviews/${reviewId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        disposition: dispositionValue,
        dispositionNotes,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setReview((prev) => (prev ? { ...prev, ...updated } : null));
    }
  }

  async function resolveClarification(clarificationId: string) {
    await fetch(`/api/clarifications/${clarificationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve" }),
    });
    // Reload
    const res = await fetch(`/api/reviews/${reviewId}`);
    setReview(await res.json());
  }

  if (loading) return <div className="p-8 text-ey-sonic-silver">Loading...</div>;
  if (!review) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <PageTitle>Review</PageTitle>
        <Card>
          <p className="text-ey-sonic-silver text-center py-4">
            Select a review from the project page to begin.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <PageTitle>
            {review.section?.displayName || "Cross-cutting"} Review
          </PageTitle>
          <div className="flex items-center gap-3 text-sm">
            <Badge color="purple">{review.domain}</Badge>
            <StatusIndicator status={review.status} />
            <span className="text-ey-sonic-silver">
              Reviewer: {review.reviewer.user.name}
            </span>
          </div>
        </div>
        <a href={`/projects/${projectId}`}>
          <Button variant="secondary">Back to Case</Button>
        </a>
      </div>

      {/* Clarifications */}
      <section className="mb-8">
        <SectionTitle>Clarifications</SectionTitle>
        {review.clarifications.length === 0 ? (
          <Card>
            <p className="text-ey-sonic-silver text-sm">No clarifications raised.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {review.clarifications.map((clar) => (
              <Card key={clar.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-medium">
                      {clar.answer.questionVersion.prompt}
                    </p>
                    <p className="text-ey-sonic-silver text-xs font-mono">
                      {clar.answer.questionVersion.question.slug}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusIndicator status={clar.status} />
                    {clar.status !== "resolved" && (
                      <Button
                        variant="secondary"
                        onClick={() => resolveClarification(clar.id)}
                      >
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>
                <div className="bg-black rounded-lg p-3 text-sm text-ey-light-gray">
                  Answer: {JSON.stringify(clar.answer.value)}
                </div>
                {/* Thread */}
                {clar.threads.map((thread) => (
                  <div key={thread.id} className="space-y-2 pl-4 border-l border-ey-sonic-silver/30">
                    {thread.comments.map((comment) => (
                      <div key={comment.id} className="text-xs">
                        <span className="text-ey-yellow font-medium">{comment.author.name}</span>
                        <span className="text-ey-sonic-silver ml-2">
                          {new Date(comment.createdAt).toLocaleString()}
                        </span>
                        <p className="text-ey-light-gray mt-0.5">{comment.body}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Disposition */}
      {review.status !== "disposed" && (
        <section className="mb-8">
          <SectionTitle>Issue Disposition</SectionTitle>
          <Card className="space-y-4">
            <div className="flex gap-3">
              {(["approve", "conditional", "reject"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDispositionValue(d)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${
                    dispositionValue === d
                      ? d === "approve"
                        ? "border-frame-green bg-frame-green/10 text-frame-green"
                        : d === "reject"
                        ? "border-frame-red bg-frame-red/10 text-frame-red"
                        : "border-frame-orange bg-frame-orange/10 text-frame-orange"
                      : "border-ey-sonic-silver/50 text-ey-light-gray hover:border-ey-yellow/30"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <textarea
              value={dispositionNotes}
              onChange={(e) => setDispositionNotes(e.target.value)}
              placeholder="Disposition notes (optional)..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-black border border-ey-sonic-silver/50 text-white placeholder:text-ey-sonic-silver focus:outline-none focus:border-ey-yellow/50 text-sm resize-y"
            />
            <Button
              onClick={issueDisposition}
              disabled={!dispositionValue || review.clarifications.some((c) => c.status !== "resolved")}
            >
              Issue Disposition
            </Button>
            {review.clarifications.some((c) => c.status !== "resolved") && (
              <p className="text-frame-orange text-xs">
                Resolve all open clarifications before issuing disposition.
              </p>
            )}
          </Card>
        </section>
      )}

      {/* Existing disposition */}
      {review.disposition && (
        <section>
          <SectionTitle>Disposition Issued</SectionTitle>
          <Card>
            <Badge
              color={
                review.disposition === "approve"
                  ? "green"
                  : review.disposition === "reject"
                  ? "red"
                  : "orange"
              }
            >
              {review.disposition}
            </Badge>
            {review.dispositionNotes && (
              <p className="text-ey-light-gray text-sm mt-3">{review.dispositionNotes}</p>
            )}
          </Card>
        </section>
      )}
    </div>
  );
}
