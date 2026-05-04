export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Hero */}
      <section className="mb-16">
        <h1 className="text-ey-yellow text-4xl font-bold mb-4 w-full">
          Attestation, Risk & Compliance
        </h1>
        <p className="text-ey-light-gray text-lg max-w-2xl">
          Answer once. Review in parallel. Ship in weeks, not months.
        </p>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        <StatCard
          value="9 months"
          label="Average approval time today"
          accent="var(--frame-red)"
        />
        <StatCard
          value="20-100"
          label="Conversations per product"
          accent="var(--frame-orange)"
        />
        <StatCard
          value="1"
          label="Foundational case needed with ARC"
          accent="var(--frame-green)"
        />
      </section>

      {/* Quick Actions */}
      <section className="mb-16">
        <h2 className="text-ey-yellow text-xl font-semibold mb-6">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ActionCard
            href="/projects/new"
            title="New Project"
            description="Start a new risk attestation for a technology product"
          />
          <ActionCard
            href="/projects"
            title="My Projects"
            description="View and continue your in-progress attestations"
          />
          <ActionCard
            href="/corpus"
            title="Question Corpus"
            description="Browse the question library and dependency graph"
          />
        </div>
      </section>

      {/* System Status */}
      <section>
        <h2 className="text-ey-yellow text-xl font-semibold mb-6">
          System Status
        </h2>
        <div className="bg-ey-dark-gray rounded-lg p-6 border border-ey-sonic-silver/30">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-frame-green animate-pulse" />
            <span className="text-ey-light-gray text-sm">
              ARC is operational — Phase 1 (Schema & Corpus)
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent: string;
}) {
  return (
    <div className="bg-ey-dark-gray rounded-lg p-6 border border-ey-sonic-silver/30">
      <div className="text-3xl font-bold mb-2" style={{ color: accent }}>
        {value}
      </div>
      <div className="text-ey-light-gray text-sm">{label}</div>
    </div>
  );
}

function ActionCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <a
      href={href}
      className="block bg-ey-dark-gray rounded-lg p-6 border border-ey-sonic-silver/30 hover:border-ey-yellow/50 transition-colors group"
    >
      <h3 className="text-white font-semibold mb-2 group-hover:text-ey-yellow transition-colors">
        {title}
      </h3>
      <p className="text-ey-light-gray text-sm">{description}</p>
    </a>
  );
}
