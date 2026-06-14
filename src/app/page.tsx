import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { closeExpiredMarkets } from "@/lib/market";
import { MarketCard } from "@/components/MarketCard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireUser();
  await closeExpiredMarkets();

  const [markets, memberCount] = await Promise.all([
    prisma.market.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        creator: { select: { name: true } },
        bets: { select: { side: true, amount: true, userId: true } },
        approvals: { select: { userId: true } },
        _count: { select: { comments: true } },
      },
    }),
    prisma.user.count(),
  ]);

  const byStatus = (s: string) => markets.filter((m) => m.status === s);
  const proposed = byStatus("PROPOSED");
  const open = byStatus("OPEN");
  const closed = byStatus("CLOSED");
  const resolved = byStatus("RESOLVED");

  return (
    <div className="stack-lg">
      <div className="hero">
        <div>
          <h1>Markets</h1>
          <p className="muted">Trade play-money points on Yes/No questions. Live odds move as people bet. Majority approves, admin resolves.</p>
        </div>
        <Link href="/markets/new" className="btn btn-primary">
          Propose a market
        </Link>
      </div>

      {proposed.length > 0 && (
        <Section title="Awaiting approval" subtitle="Vote to open these for betting">
          {proposed.map((m) => (
            <MarketCard key={m.id} market={m} userId={user.id} memberCount={memberCount} />
          ))}
        </Section>
      )}

      <Section title="Open" subtitle="Betting live">
        {open.length ? (
          open.map((m) => <MarketCard key={m.id} market={m} userId={user.id} memberCount={memberCount} />)
        ) : (
          <Empty>No open markets yet. Propose one to get started.</Empty>
        )}
      </Section>

      {closed.length > 0 && (
        <Section title="Awaiting resolution">
          {closed.map((m) => (
            <MarketCard key={m.id} market={m} userId={user.id} memberCount={memberCount} />
          ))}
        </Section>
      )}

      {resolved.length > 0 && (
        <Section title="Resolved">
          {resolved.map((m) => (
            <MarketCard key={m.id} market={m} userId={user.id} memberCount={memberCount} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="stack">
      <div className="section-head">
        <h2>{title}</h2>
        {subtitle ? <span className="muted small">{subtitle}</span> : null}
      </div>
      <div className="grid">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}
