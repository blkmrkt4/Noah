"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button } from "./ui";
import { SlugReveal } from "./SlugReveal";

type Tab = "collaboration" | "reviewers";

interface UserLite {
  id: string;
  name: string;
  email: string;
}

interface Comment {
  id: string;
  body: string;
  authorKind: "user" | "system";
  createdAt: string;
  author: UserLite;
}

interface QuestionContext {
  questionVersionId: string;
  slug: string;
  section: string;
  sectionName: string;
  prompt: string;
  required: boolean;
  isActive: boolean;
  answer: {
    id: string;
    value: unknown;
    source: "system_inferred" | "owner_attested" | "collaborator_supplied";
    aiConfidence: number | null;
    citation: string | null;
    inClarification: boolean;
    attester: UserLite | null;
    answeredAt?: string;
  } | null;
}

interface DelegationRow {
  id: string;
  scopeType: "section" | "question_set";
  scopeTarget: { questionVersionIds?: string[]; sectionId?: string } & Record<string, unknown>;
  status: string;
  assignee: UserLite;
  assigner: UserLite;
  createdAt: string;
}

export default function QuestionContextPanel({
  projectId,
  question,
  sectionState,
  commercialOwnerId,
  currentSectionSlug,
}: {
  projectId: string;
  question: QuestionContext | null;
  sectionState: string;
  commercialOwnerId?: string;
  currentSectionSlug?: string | null;
}) {
  const [tab, setTab] = useState<Tab>("collaboration");

  return (
    <div className="flex flex-col h-full min-h-0">
      <TabStrip active={tab} onChange={setTab} />
      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === "collaboration" && (
          <CollaborationTab
            projectId={projectId}
            question={question}
            sectionSlug={currentSectionSlug ?? null}
            commercialOwnerId={commercialOwnerId}
          />
        )}
        {tab === "reviewers" && (
          <ReviewersTab projectId={projectId} sectionSlug={currentSectionSlug ?? null} />
        )}
      </div>
    </div>
  );
}

function TabStrip({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "collaboration", label: "Collaboration" },
    { id: "reviewers", label: "Reviewers" },
  ];
  return (
    <div className="flex border-b border-ey-dark-gray text-xs flex-shrink-0">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex-1 px-3 py-2 transition-colors border-b-2 whitespace-nowrap ${
            active === t.id
              ? "border-ey-yellow text-ey-yellow"
              : "border-transparent text-ey-light-gray hover:text-white"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function QuestionZone({
  projectId,
  question,
  commercialOwnerId,
}: {
  projectId: string;
  question: QuestionContext;
  commercialOwnerId?: string;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [delegations, setDelegations] = useState<DelegationRow[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [showDelegate, setShowDelegate] = useState(false);

  const answerId = question.answer?.id ?? null;
  const questionVersionId = question.questionVersionId;

  useEffect(() => {
    if (!answerId) {
      setComments([]);
      return;
    }
    void fetch(`/api/projects/${projectId}/answers/${answerId}/thread`)
      .then((res) => (res.ok ? res.json() : { comments: [] }))
      .then((data) => setComments(data.comments ?? []));
  }, [answerId, projectId]);

  useEffect(() => {
    void Promise.all([
      fetch(`/api/projects/${projectId}/delegations`).then((r) => r.json()),
      fetch(`/api/users`).then((r) => r.json()),
    ]).then(([dels, us]) => {
      setDelegations(Array.isArray(dels) ? dels : []);
      setUsers(Array.isArray(us) ? us : []);
    });
  }, [projectId]);

  const currentDelegation = useMemo(() => {
    return (
      delegations.find((d) => {
        const target = d.scopeTarget;
        if (d.scopeType !== "question_set") return false;
        const ids = target?.questionVersionIds;
        return Array.isArray(ids) && ids.includes(questionVersionId);
      }) ?? null
    );
  }, [delegations, questionVersionId]);

  const orderedUsers = useMemo(() => {
    const seen = new Set<string>();
    const out: UserLite[] = [];
    for (const d of delegations) {
      if (!seen.has(d.assignee.id)) {
        seen.add(d.assignee.id);
        out.push(d.assignee);
      }
    }
    if (commercialOwnerId) {
      const owner = users.find((u) => u.id === commercialOwnerId);
      if (owner && !seen.has(owner.id)) {
        seen.add(owner.id);
        out.push(owner);
      }
    }
    for (const u of users) {
      if (!seen.has(u.id)) {
        seen.add(u.id);
        out.push(u);
      }
    }
    return out;
  }, [delegations, users, commercialOwnerId]);

  async function postComment() {
    if (!answerId || !draft.trim()) return;
    setPosting(true);
    await fetch(`/api/projects/${projectId}/answers/${answerId}/thread`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: draft }),
    });
    setDraft("");
    const res = await fetch(`/api/projects/${projectId}/answers/${answerId}/thread`);
    const data = res.ok ? await res.json() : { comments: [] };
    setComments(data.comments ?? []);
    setPosting(false);
  }

  async function delegate(assigneeId: string, message?: string) {
    if (!commercialOwnerId) return;
    const res = await fetch(`/api/projects/${projectId}/delegations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scopeType: "question_set",
        scopeTarget: { questionVersionIds: [questionVersionId] },
        assignerId: commercialOwnerId,
        assigneeId,
        message: message?.trim() || undefined,
      }),
    });
    if (res.ok) {
      const refreshed = await fetch(`/api/projects/${projectId}/delegations`).then((r) => r.json());
      setDelegations(Array.isArray(refreshed) ? refreshed : []);
      setShowDelegate(false);
    }
  }

  async function delegateToNewEmail(email: string, name: string, message?: string) {
    if (!email.trim()) return;
    const userRes = await fetch(`/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), name: name.trim() || email.trim() }),
    });
    if (!userRes.ok) return;
    const newUser: UserLite = await userRes.json();
    await delegate(newUser.id, message);
  }

  // Show "Answered by" only when it adds information beyond the question
  // card's badge — i.e., AI inferred (citation matters) or a Collaborator
  // (not the Owner) supplied the answer. Owner self-attestation is implicit
  // and would just repeat the badge.
  const showAnsweredBy =
    question.answer?.source === "system_inferred" ||
    question.answer?.source === "collaborator_supplied";

  return (
    <div className="px-5 pt-5 pb-4 space-y-4 text-sm border-b border-ey-dark-gray">
      <p className="text-[10px] uppercase tracking-wider text-ey-sonic-silver">
        This question
      </p>

      {showAnsweredBy && (
        <AnsweredBy
          answer={question.answer}
          commercialOwnerId={commercialOwnerId}
          users={users}
        />
      )}

      {question.answer?.source === "system_inferred" && question.answer.citation && (
        <div className="border-l-2 border-ey-yellow/40 pl-3">
          <p className="text-[10px] uppercase tracking-wider text-ey-sonic-silver mb-1">
            AI citation
          </p>
          <p className="text-xs text-ey-light-gray">{question.answer.citation}</p>
        </div>
      )}

      {question.answer?.inClarification && (
        <div className="rounded border border-frame-orange/40 bg-frame-orange/5 p-3">
          <p className="text-xs text-frame-orange">
            A reviewer has opened a clarification on this question. The owner
            can edit and resubmit.
          </p>
        </div>
      )}

      <DelegationBlock
        delegation={currentDelegation}
        showForm={showDelegate}
        onToggleForm={() => setShowDelegate((v) => !v)}
        users={orderedUsers}
        onDelegate={delegate}
        onDelegateNew={delegateToNewEmail}
        commercialOwnerId={commercialOwnerId}
      />

      <div>
        <p className="text-[10px] uppercase tracking-wider text-ey-sonic-silver mb-2">
          Discussion
        </p>
        {!question.answer ? (
          <p className="text-xs text-ey-sonic-silver">
            Answer the question first to start a thread.
          </p>
        ) : (
          <>
            <ul className="space-y-3 mb-3 max-h-64 overflow-y-auto pr-1">
              {comments.length === 0 && (
                <li className="text-xs text-ey-sonic-silver">No comments yet.</li>
              )}
              {comments.map((c) => (
                <li key={c.id} className="text-xs">
                  <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <span className="text-ey-yellow font-semibold truncate">
                      {c.authorKind === "system" ? "system" : c.author?.name ?? "anon"}
                    </span>
                    <span className="text-ey-sonic-silver shrink-0">
                      {new Date(c.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-ey-light-gray whitespace-pre-wrap">{c.body}</p>
                </li>
              ))}
            </ul>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              placeholder="Add a comment..."
              className="w-full px-2 py-1.5 rounded bg-black border border-ey-sonic-silver/40 text-white text-xs placeholder:text-ey-sonic-silver focus:outline-none focus:border-ey-yellow/50"
            />
            <div className="mt-2">
              <Button onClick={postComment} disabled={posting || !draft.trim()}>
                {posting ? "Posting..." : "Post"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AnsweredBy({
  answer,
  commercialOwnerId,
  users,
}: {
  answer: QuestionContext["answer"];
  commercialOwnerId?: string;
  users: UserLite[];
}) {
  if (!answer) {
    return (
      <p className="text-xs text-ey-sonic-silver">Not answered yet.</p>
    );
  }
  const ts = answer.answeredAt ? new Date(answer.answeredAt).toLocaleString() : null;

  if (answer.source === "system_inferred") {
    return (
      <div className="text-xs">
        <p className="text-[10px] uppercase tracking-wider text-ey-sonic-silver mb-1">Source</p>
        <p className="text-ey-light-gray">
          AI suggested
          {answer.aiConfidence != null && (
            <span className="text-ey-sonic-silver"> · {Math.round(answer.aiConfidence * 100)}% confidence</span>
          )}
        </p>
        {ts && <p className="text-[11px] text-ey-sonic-silver mt-0.5">{ts}</p>}
      </div>
    );
  }

  const fallbackOwner = users.find((u) => u.id === commercialOwnerId) ?? null;
  const person = answer.attester ?? (answer.source === "owner_attested" ? fallbackOwner : null);
  const roleLabel = answer.source === "collaborator_supplied" ? "Collaborator" : "Commercial owner";

  return (
    <div className="text-xs">
      <p className="text-[10px] uppercase tracking-wider text-ey-sonic-silver mb-1">Answered by</p>
      {person ? (
        <>
          <p className="text-white font-medium">{person.name}</p>
          <p className="text-ey-sonic-silver text-[11px]">
            {person.email} · {roleLabel}
          </p>
        </>
      ) : (
        <p className="text-ey-light-gray">{roleLabel}</p>
      )}
      {ts && <p className="text-[11px] text-ey-sonic-silver mt-0.5">{ts}</p>}
    </div>
  );
}

function DelegationBlock({
  delegation,
  showForm,
  onToggleForm,
  users,
  onDelegate,
  onDelegateNew,
  commercialOwnerId,
}: {
  delegation: DelegationRow | null;
  showForm: boolean;
  onToggleForm: () => void;
  users: UserLite[];
  onDelegate: (assigneeId: string, message?: string) => void;
  onDelegateNew: (email: string, name: string, message?: string) => void;
  commercialOwnerId?: string;
}) {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const trimmed = query.trim();
  const filtered = useMemo(() => {
    if (!trimmed) return users.slice(0, 6);
    const q = trimmed.toLowerCase();
    return users
      .filter(
        (u) => u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [users, trimmed]);

  const exactEmailMatch = users.find((u) => u.email.toLowerCase() === trimmed.toLowerCase());
  const isEmailLike = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  const isEyEmail = /@ey\.com$/i.test(trimmed);
  const canCreateNew = isEmailLike && isEyEmail && !exactEmailMatch;

  if (delegation) {
    return (
      <div className="rounded border border-frame-blue/40 bg-frame-blue/5 p-3 text-xs space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-ey-sonic-silver">Delegated</p>
        <p className="text-white font-medium">{delegation.assignee.name}</p>
        <p className="text-ey-sonic-silver text-[11px]">
          {delegation.assignee.email} · {delegation.status}
        </p>
        <p className="text-ey-sonic-silver text-[11px]">
          by {delegation.assigner.name}
        </p>
      </div>
    );
  }

  if (!commercialOwnerId) return null;

  if (!showForm) {
    return (
      <div>
        <Button variant="secondary" onClick={onToggleForm}>
          Delegate this question
        </Button>
      </div>
    );
  }

  async function handlePick(userId: string) {
    setSubmitting(true);
    await onDelegate(userId, message);
    setSubmitting(false);
    setQuery("");
    setMessage("");
  }

  async function handleCreateNew() {
    if (!canCreateNew) return;
    setSubmitting(true);
    await onDelegateNew(trimmed, trimmed.split("@")[0], message);
    setSubmitting(false);
    setQuery("");
    setMessage("");
  }

  return (
    <div className="space-y-2 rounded border border-ey-sonic-silver/30 p-3">
      <p className="text-[10px] uppercase tracking-wider text-ey-sonic-silver">
        Delegate to
      </p>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name or @ey.com email"
        className="w-full px-2 py-1.5 rounded bg-black border border-ey-sonic-silver/40 text-white text-xs placeholder:text-ey-sonic-silver focus:outline-none focus:border-ey-yellow/50"
      />
      {filtered.length > 0 && (
        <ul className="space-y-1">
          {filtered.map((u) => (
            <li key={u.id}>
              <button
                onClick={() => handlePick(u.id)}
                disabled={submitting}
                className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-ey-dark-gray transition-colors disabled:opacity-50"
              >
                <span className="text-white">{u.name}</span>
                <span className="text-ey-sonic-silver"> · {u.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {canCreateNew && (
        <button
          onClick={handleCreateNew}
          disabled={submitting}
          className="w-full text-left px-2 py-1.5 rounded text-xs border border-dashed border-ey-yellow/40 text-ey-yellow hover:bg-ey-yellow/5 transition-colors disabled:opacity-50"
        >
          Add &amp; delegate to {trimmed}
        </button>
      )}
      {trimmed && !canCreateNew && filtered.length === 0 && (
        <p className="text-[11px] text-ey-sonic-silver">
          {isEmailLike && !isEyEmail
            ? "Only @ey.com emails can be delegates."
            : "No matches. Type a full @ey.com email to add someone new."}
        </p>
      )}
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={2}
        placeholder="Optional note for the delegate..."
        className="w-full px-2 py-1.5 rounded bg-black border border-ey-sonic-silver/40 text-white text-xs placeholder:text-ey-sonic-silver focus:outline-none focus:border-ey-yellow/50 resize-none"
      />
      <div className="flex justify-end">
        <button
          onClick={onToggleForm}
          className="text-[11px] text-ey-sonic-silver hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Activity tabs (Collaboration + Reviewers)
// ─────────────────────────────────────────────────────

interface FeedItem {
  id: string;
  kind: "comment" | "answer" | "review" | "clarification" | "delegation";
  actor: UserLite;
  questionSlug: string | null;
  sectionSlug: string | null;
  domain?: string;
  jurisdictions?: string[];
  summary: string;
  body?: string;
  timestamp: string;
}

interface CollaborationPayload {
  items: FeedItem[];
  totalAll: number;
  totalScoped: number;
  facets: { byAuthor: { id: string; name: string; email: string; count: number }[] };
}

function ScopeToggle({
  scope,
  onChange,
  hasSection,
}: {
  scope: "project" | "section";
  onChange: (s: "project" | "section") => void;
  hasSection: boolean;
}) {
  return (
    <div className="flex items-center justify-between flex-shrink-0">
      <span className="text-[10px] uppercase tracking-wider text-ey-sonic-silver">
        Scope
      </span>
      <div className="flex rounded-full border border-ey-sonic-silver/40 overflow-hidden text-[10px]">
        <button
          onClick={() => onChange("section")}
          disabled={!hasSection}
          className={`px-2.5 py-0.5 transition-colors disabled:opacity-40 ${
            scope === "section"
              ? "bg-ey-yellow text-black"
              : "text-ey-light-gray hover:bg-ey-dark-gray"
          }`}
        >
          Section
        </button>
        <button
          onClick={() => onChange("project")}
          className={`px-2.5 py-0.5 transition-colors ${
            scope === "project"
              ? "bg-ey-yellow text-black"
              : "text-ey-light-gray hover:bg-ey-dark-gray"
          }`}
        >
          Project
        </button>
      </div>
    </div>
  );
}

function FilterRow({
  label,
  sublabel,
  count,
  active,
  onClick,
}: {
  label: string;
  sublabel?: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const dim = count === 0;
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
        active
          ? "bg-ey-yellow/10 text-ey-yellow"
          : dim
            ? "text-ey-sonic-silver"
            : "text-ey-light-gray hover:bg-ey-dark-gray hover:text-white"
      }`}
    >
      <span className="truncate text-left flex-1 min-w-0">
        <span>{label}</span>
        {sublabel && <span className="text-ey-sonic-silver"> · {sublabel}</span>}
      </span>
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono shrink-0 ${
          active
            ? "bg-ey-yellow/20 text-ey-yellow"
            : "bg-ey-dark-gray text-ey-sonic-silver"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function FeedItemRow({ item }: { item: FeedItem }) {
  return (
    <li className="border-l border-ey-sonic-silver/20 pl-3 py-1">
      <div className="flex items-baseline justify-between gap-2 mb-0.5">
        <span className="text-white text-xs font-medium truncate">{item.actor.name}</span>
        <span className="text-[10px] text-ey-sonic-silver shrink-0">
          {new Date(item.timestamp).toLocaleString()}
        </span>
      </div>
      <p className="text-[11px] text-ey-light-gray">
        {item.summary}
        {item.questionSlug && (
          <span className="ml-1">
            <SlugReveal slug={item.questionSlug} />
          </span>
        )}
      </p>
      {item.body && (
        <p className="text-[11px] text-ey-light-gray mt-1 whitespace-pre-wrap">{item.body}</p>
      )}
      {(item.domain || (item.jurisdictions && item.jurisdictions.length > 0)) && (
        <div className="flex flex-wrap gap-1 mt-1">
          {item.domain && <Badge color="default">{item.domain}</Badge>}
          {item.jurisdictions?.map((j) => (
            <Badge key={j} color="default">
              {j}
            </Badge>
          ))}
        </div>
      )}
    </li>
  );
}

function CollaborationTab({
  projectId,
  question,
  sectionSlug,
  commercialOwnerId,
}: {
  projectId: string;
  question: QuestionContext | null;
  sectionSlug: string | null;
  commercialOwnerId?: string;
}) {
  const hasSection = !!sectionSlug;
  const [scope, setScope] = useState<"project" | "section">(hasSection ? "section" : "project");
  const [filter, setFilter] = useState<string | null>(null);
  const [data, setData] = useState<CollaborationPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url =
      `/api/projects/${projectId}/activity?type=collaboration` +
      (scope === "section" && sectionSlug ? `&section=${encodeURIComponent(sectionSlug)}` : "");
    void fetch(url)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [projectId, scope, sectionSlug]);

  const items = useMemo(() => {
    if (!data) return [];
    if (!filter) return data.items;
    return data.items.filter((i) => i.actor.id === filter);
  }, [data, filter]);

  return (
    <div className="flex flex-col h-full text-sm">
      {question ? (
        <QuestionZone
          projectId={projectId}
          question={question}
          commercialOwnerId={commercialOwnerId}
        />
      ) : null}

      <div className="p-4 space-y-3 flex flex-col flex-1 min-h-0">
        <p className="text-[10px] uppercase tracking-wider text-ey-sonic-silver">
          Activity
        </p>

        <ScopeToggle scope={scope} onChange={setScope} hasSection={hasSection} />

        <div>
          <p className="text-[10px] uppercase tracking-wider text-ey-sonic-silver mb-1.5">
            Contributors
          </p>
          <div className="space-y-0.5">
            <FilterRow
              label="All activity"
              count={data?.totalScoped ?? 0}
              active={filter === null}
              onClick={() => setFilter(null)}
            />
            {(data?.facets.byAuthor ?? []).map((a) => (
              <FilterRow
                key={a.id}
                label={a.name}
                sublabel={a.email}
                count={a.count}
                active={filter === a.id}
                onClick={() => setFilter(a.id)}
              />
            ))}
            {data && data.facets.byAuthor.length === 0 && !loading && (
              <p className="text-[11px] text-ey-sonic-silver px-2 py-1">
                No collaborator activity yet.
              </p>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <p className="text-xs text-ey-sonic-silver">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-xs text-ey-sonic-silver">
              {filter ? "No activity from this contributor in this scope." : "Nothing to show."}
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((i) => (
                <FeedItemRow key={`${i.kind}-${i.id}`} item={i} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// Reviewers tab
// ─────────────────────────────────────────────────────

const DOMAIN_LABEL: Record<string, string> = {
  legal: "Legal",
  jurisdictional: "Legal",
  independence: "Independence",
  privacy: "Privacy",
  brand: "Brand",
  security: "InfoSec",
  ai: "AI",
  contracts: "Contracts",
  retention: "Retention",
  oss: "Open Source",
  nss: "Non-Standard SW",
  bia: "BIA",
  accessibility: "Accessibility",
  service_lines: "Service Lines",
};

interface ReviewerPayload {
  items: FeedItem[];
  totalAll: number;
  totalScoped: number;
  facets: {
    byDomain: { id: string; count: number }[];
    byJurisdiction: { id: string; count: number }[];
  };
}

function ReviewersTab({
  projectId,
  sectionSlug,
}: {
  projectId: string;
  sectionSlug: string | null;
}) {
  const hasSection = !!sectionSlug;
  const [scope, setScope] = useState<"project" | "section">(hasSection ? "section" : "project");
  const [domainFilter, setDomainFilter] = useState<string | null>(null);
  const [jurisdictionFilter, setJurisdictionFilter] = useState<string | null>(null);
  const [data, setData] = useState<ReviewerPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url =
      `/api/projects/${projectId}/activity?type=reviewer` +
      (scope === "section" && sectionSlug ? `&section=${encodeURIComponent(sectionSlug)}` : "");
    void fetch(url)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [projectId, scope, sectionSlug]);

  const items = useMemo(() => {
    if (!data) return [];
    return data.items.filter((i) => {
      if (domainFilter && i.domain !== domainFilter) return false;
      if (jurisdictionFilter && !(i.jurisdictions ?? []).includes(jurisdictionFilter)) return false;
      return true;
    });
  }, [data, domainFilter, jurisdictionFilter]);

  return (
    <div className="p-4 space-y-3 text-sm flex flex-col h-full">
      <ScopeToggle scope={scope} onChange={setScope} hasSection={hasSection} />

      <div>
        <p className="text-[10px] uppercase tracking-wider text-ey-sonic-silver mb-1.5">
          Domain
        </p>
        <div className="space-y-0.5">
          <FilterRow
            label="All domains"
            count={data?.totalScoped ?? 0}
            active={domainFilter === null}
            onClick={() => setDomainFilter(null)}
          />
          {(data?.facets.byDomain ?? []).map((d) => (
            <FilterRow
              key={d.id}
              label={DOMAIN_LABEL[d.id] ?? d.id}
              count={d.count}
              active={domainFilter === d.id}
              onClick={() => setDomainFilter(d.id)}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-ey-sonic-silver mb-1.5">
          Jurisdiction
        </p>
        <div className="space-y-0.5">
          <FilterRow
            label="All jurisdictions"
            count={data?.totalScoped ?? 0}
            active={jurisdictionFilter === null}
            onClick={() => setJurisdictionFilter(null)}
          />
          {(data?.facets.byJurisdiction ?? []).map((j) => (
            <FilterRow
              key={j.id}
              label={j.id}
              count={j.count}
              active={jurisdictionFilter === j.id}
              onClick={() => setJurisdictionFilter(j.id)}
            />
          ))}
          {data && data.facets.byJurisdiction.length === 0 && !loading && (
            <p className="text-[11px] text-ey-sonic-silver px-2 py-1">
              No reviewers assigned yet.
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-ey-sonic-silver">Loading...</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-ey-sonic-silver">
            {domainFilter || jurisdictionFilter
              ? "No reviewer activity matches the current filters."
              : "No reviewer activity yet."}
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((i) => (
              <FeedItemRow key={`${i.kind}-${i.id}`} item={i} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export type { QuestionContext };
