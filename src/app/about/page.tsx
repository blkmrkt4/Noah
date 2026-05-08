import Link from "next/link";
import type { ReactNode } from "react";

export default function AboutPage() {
  return (
    <div className="px-6 py-8 max-w-7xl space-y-10">
      <Hero />
      <Promise />
      <Personas />
      <ProcessFlow />
      <Outcome />
    </div>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 items-end">
      <div>
        <p className="text-ey-sonic-silver text-xs uppercase tracking-[0.2em] mb-2">
          Attestation · Risk · Compliance
        </p>
        <h1 className="text-ey-yellow text-5xl lg:text-6xl font-bold leading-tight">
          ARC
        </h1>
        <p className="text-white text-xl lg:text-2xl mt-3 leading-snug max-w-2xl">
          EY&apos;s risk attestation system for technology products.
          <span className="text-ey-yellow"> Answer once. Review in parallel. Defensible by audit trail.</span>
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <Stat n="12" label="Risk domains" tone="yellow" />
        <Stat n="200+" label="Questions" tone="blue" />
        <Stat n="1" label="Attestation" tone="green" />
      </div>
    </section>
  );
}

function Stat({
  n,
  label,
  tone,
}: {
  n: string;
  label: string;
  tone: "yellow" | "blue" | "green";
}) {
  const c = {
    yellow: "text-ey-yellow",
    blue: "text-frame-blue",
    green: "text-frame-green",
  }[tone];
  return (
    <div className="bg-ey-dark-gray border border-ey-sonic-silver/30 rounded-lg p-4">
      <div className={`text-3xl font-bold ${c} tabular-nums`}>{n}</div>
      <div className="text-[10px] uppercase tracking-wider text-ey-sonic-silver mt-1">
        {label}
      </div>
    </div>
  );
}

// ─── Promise ───────────────────────────────────────────────────────────────────

function Promise() {
  return (
    <section className="bg-ey-dark-gray border-l-4 border-ey-yellow rounded-r-lg p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="text-ey-yellow text-2xl font-semibold mb-2">
            One asset. Every jurisdiction. Once.
          </h2>
          <p className="text-ey-light-gray leading-relaxed">
            Today, the same product gets re-questioned in every market it
            enters. Privacy in the UK. Independence in the US. AI in the EU.
            Brand globally. Each review starts from zero, each owner re-types
            the same answers, each risk domain reaches its own conclusion in
            isolation.
          </p>
          <p className="text-white leading-relaxed mt-3">
            ARC is one place where the Commercial Owner answers a
            dependency-driven question set <span className="text-ey-yellow font-semibold">once</span>,
            attaches the evidence <span className="text-ey-yellow font-semibold">once</span>, and
            every reviewer in every jurisdiction sees the same canonical
            answers with the citation that supports them.
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <ValueLine n="1" text="Owner answers once." />
          <ValueLine n="2" text="Repo + documents auto-populate where they can." />
          <ValueLine n="3" text="Every reviewer sees the same evidence." />
          <ValueLine n="4" text="Sign-off is recorded against the answer." />
          <ValueLine n="5" text="Disagreements become Discrepancy rows, not lost emails." />
        </div>
      </div>
    </section>
  );
}

function ValueLine({ n, text }: { n: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-ey-yellow text-black text-[10px] font-bold flex items-center justify-center">
        {n}
      </span>
      <span className="text-ey-light-gray">{text}</span>
    </div>
  );
}

// ─── Personas ─────────────────────────────────────────────────────────────────

function Personas() {
  return (
    <section>
      <SectionHeader
        eyebrow="Who uses ARC"
        title="Four personas. Four toolsets. One canonical record."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        <PersonaCard
          tone="purple"
          name="Policy Author"
          role="Owns the question corpus."
          tools={[
            "Authoring · Questions",
            "Authoring · Sections",
            "Patterns library",
            "Dependency rules",
          ]}
        />
        <PersonaCard
          tone="blue"
          name="Policy Owner"
          role="Owns policies + guidance for each question."
          tools={[
            "Authoring · Policies",
            "Guidance editor",
            "Guidance scans",
            "Per-question guidance toggle",
          ]}
        />
        <PersonaCard
          tone="yellow"
          name="Commercial Owner"
          role="Attests to the truth about an asset."
          tools={[
            "Asset workspace",
            "Ingestion (repo + docs + links)",
            "3 repo scans (technical · risk · pre-pop)",
            "Questionnaire",
            "Delegations",
          ]}
        />
        <PersonaCard
          tone="orange"
          name="Risk Reviewer"
          role="Signs off on a domain."
          tools={[
            "Review queue (per domain)",
            "Per-answer sign-off",
            "Clarifications",
            "Remarks",
            "Disposition (approve · conditional · reject)",
          ]}
        />
      </div>
    </section>
  );
}

function PersonaCard({
  tone,
  name,
  role,
  tools,
}: {
  tone: "purple" | "blue" | "yellow" | "orange";
  name: string;
  role: string;
  tools: string[];
}) {
  const palette = {
    purple: {
      border: "border-frame-purple/60",
      accent: "border-l-frame-purple",
      title: "text-frame-purple",
      bg: "bg-frame-purple/5",
    },
    blue: {
      border: "border-frame-blue/60",
      accent: "border-l-frame-blue",
      title: "text-frame-blue",
      bg: "bg-frame-blue/5",
    },
    yellow: {
      border: "border-ey-yellow/60",
      accent: "border-l-ey-yellow",
      title: "text-ey-yellow",
      bg: "bg-ey-yellow/5",
    },
    orange: {
      border: "border-frame-orange/60",
      accent: "border-l-frame-orange",
      title: "text-frame-orange",
      bg: "bg-frame-orange/5",
    },
  }[tone];

  return (
    <div
      className={`rounded-lg border-l-4 ${palette.accent} border-r border-t border-b ${palette.border} ${palette.bg} p-4`}
    >
      <h3 className={`${palette.title} text-base font-semibold mb-1`}>
        {name}
      </h3>
      <p className="text-ey-light-gray text-xs mb-3 leading-snug">{role}</p>
      <p className="text-[10px] uppercase tracking-wider text-ey-sonic-silver mb-1.5">
        Tools
      </p>
      <ul className="space-y-1">
        {tools.map((t) => (
          <li key={t} className="text-xs text-white flex items-start gap-1.5">
            <span className={`${palette.title} flex-shrink-0`}>•</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Process flow ─────────────────────────────────────────────────────────────

function ProcessFlow() {
  return (
    <section>
      <SectionHeader
        eyebrow="How the work moves"
        title="From corpus to attestation, parallel paths land on one record."
      />
      <div className="space-y-3 mt-4">
        <Lane
          tone="purple"
          persona="Policy Author"
          steps={[
            "Drafts new question or revises an existing one",
            "Attaches documents that motivated it",
            "Sets dependency rules + section",
            "Publishes a new QuestionVersion",
          ]}
        />
        <Lane
          tone="blue"
          persona="Policy Owner"
          steps={[
            "Uploads policy documents to the library",
            "Runs guidance scan over the question corpus",
            "Reviews and approves AI-extracted guidance",
            "Toggles guidance off for trivial questions",
          ]}
        />
        <Lane
          tone="yellow"
          persona="Commercial Owner"
          steps={[
            "Creates an asset, names it, picks jurisdictions",
            "Connects GitHub repo + uploads project documents + adds reference links",
            "Runs three repo scans: technical · risk · question pre-population",
            "Walks the questionnaire — answers what only they know",
            "Delegates open questions to specialists; clears one section at a time",
          ]}
        />
        <Lane
          tone="orange"
          persona="Risk Reviewer"
          steps={[
            "Sees their domain's queue across every project",
            "Reads the canonical answer + citation + AI confidence",
            "Asks clarifications · adds remarks · raises a discrepancy",
            "Signs off (approve · conditional · reject) on each section",
          ]}
        />
      </div>
      <div className="mt-4 bg-ey-black border border-ey-sonic-silver/30 rounded-lg px-5 py-4 text-center">
        <p className="text-xs uppercase tracking-wider text-ey-sonic-silver mb-1">
          Result
        </p>
        <p className="text-ey-yellow text-lg font-semibold">
          One attestation, defensible across every jurisdiction the asset touches.
        </p>
      </div>
    </section>
  );
}

function Lane({
  tone,
  persona,
  steps,
}: {
  tone: "purple" | "blue" | "yellow" | "orange";
  persona: string;
  steps: string[];
}) {
  const palette = {
    purple: { bar: "bg-frame-purple", text: "text-frame-purple" },
    blue: { bar: "bg-frame-blue", text: "text-frame-blue" },
    yellow: { bar: "bg-ey-yellow", text: "text-ey-yellow" },
    orange: { bar: "bg-frame-orange", text: "text-frame-orange" },
  }[tone];

  return (
    <div className="bg-ey-dark-gray rounded-lg border border-ey-sonic-silver/20 overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr]">
        <div className={`${palette.bar} px-4 py-3 flex items-center`}>
          <p className="text-black text-sm font-semibold">{persona}</p>
        </div>
        <div className="p-3">
          <ol className="flex flex-col md:flex-row md:flex-wrap gap-2">
            {steps.map((step, i) => (
              <li
                key={i}
                className="flex items-start gap-2 md:flex-1 md:min-w-[180px] bg-black/30 rounded px-3 py-2"
              >
                <span
                  className={`flex-shrink-0 w-5 h-5 rounded-full ${palette.bar} text-black text-[10px] font-bold flex items-center justify-center mt-0.5`}
                >
                  {i + 1}
                </span>
                <span className="text-xs text-ey-light-gray leading-snug">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

// ─── Outcome / Why ARC ────────────────────────────────────────────────────────

function Outcome() {
  return (
    <section>
      <SectionHeader
        eyebrow="The point"
        title="ARC turns a thousand bilateral conversations into one canonical record."
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <OutcomeCard
          icon={<IconClock />}
          title="Owners answer once"
          body="The same product entering five jurisdictions does not become five questionnaires. It becomes one record with five reviewer queues."
        />
        <OutcomeCard
          icon={<IconShield />}
          title="Reviewers see the evidence"
          body="Every answer is shown with its citation — file path, line, document quote, or owner attestation. Disagreements become Discrepancy rows, not lost emails."
        />
        <OutcomeCard
          icon={<IconBranch />}
          title="The audit trail is the system"
          body="Question versions, policy versions, scan runs, sign-offs, delegations — all immutable. Re-creating a decision six months later is a query, not a forensics exercise."
        />
      </div>
      <div className="flex flex-wrap gap-3 mt-6">
        <Link
          href="/projects"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-ey-yellow text-black font-medium text-sm hover:bg-ey-yellow/90 transition-colors"
        >
          Open Assets in Process
        </Link>
        <Link
          href="/"
          className="inline-flex items-center px-4 py-2 rounded-lg bg-ey-dark-gray text-white border border-ey-sonic-silver/40 font-medium text-sm hover:border-ey-yellow/50 transition-colors"
        >
          Open Dashboard
        </Link>
      </div>
    </section>
  );
}

function OutcomeCard({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-ey-dark-gray border border-ey-sonic-silver/30 rounded-lg p-5">
      <div className="text-ey-yellow mb-3">{icon}</div>
      <h3 className="text-white font-semibold text-base mb-1.5">{title}</h3>
      <p className="text-ey-light-gray text-sm leading-relaxed">{body}</p>
    </div>
  );
}

// ─── Bits ─────────────────────────────────────────────────────────────────────

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-ey-sonic-silver text-[10px] uppercase tracking-[0.2em] mb-1">
        {eyebrow}
      </p>
      <h2 className="text-ey-yellow text-2xl font-semibold leading-tight">
        {title}
      </h2>
    </div>
  );
}

function IconClock() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function IconBranch() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}
