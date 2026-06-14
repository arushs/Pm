import Link from "next/link";
import { probYes } from "@/lib/amm";
import { requiredApprovals } from "@/lib/config";
import { pts, pct, timeUntil } from "@/lib/format";

type CardMarket = {
  id: string;
  title: string;
  category: string;
  status: string;
  outcome: string | null;
  closesAt: Date;
  yesPool: number;
  noPool: number;
  creator: { name: string };
  bets: { side: string; amount: number; shares: number; userId: string }[];
  approvals: { userId: string }[];
  _count: { comments: number };
};

export function MarketCard({
  market,
  userId,
  memberCount,
}: {
  market: CardMarket;
  userId: string;
  memberCount: number;
}) {
  const prob = probYes(market.yesPool, market.noPool);
  const volume = market.bets.reduce((s, b) => s + b.amount, 0);
  const yourYes = market.bets.filter((b) => b.userId === userId && b.side === "YES").reduce((s, b) => s + b.shares, 0);
  const yourNo = market.bets.filter((b) => b.userId === userId && b.side === "NO").reduce((s, b) => s + b.shares, 0);
  const youApproved = market.approvals.some((a) => a.userId === userId);
  const need = requiredApprovals(memberCount);

  return (
    <Link href={`/markets/${market.id}`} className="card">
      <div className="card-top">
        <span className="pill pill-cat">{market.category}</span>
        <StatusPill status={market.status} outcome={market.outcome} />
      </div>
      <h3 className="card-title">{market.title}</h3>

      {market.status === "PROPOSED" ? (
        <div className="approve-row">
          <div className="progress">
            <div
              className="progress-bar"
              style={{ width: `${Math.min(100, (market.approvals.length / need) * 100)}%` }}
            />
          </div>
          <span className="muted small">
            {market.approvals.length}/{need} approvals{youApproved ? " · you approved" : ""}
          </span>
        </div>
      ) : (
        <>
          <div className="prob-row">
            <span className="prob-big">{pct(prob)}</span>
            <span className="muted small">chance</span>
          </div>
          <div className="odds-bar">
            <div className="odds-yes" style={{ width: `${Math.round(prob * 100)}%` }} />
          </div>
          <div className="card-meta muted small">
            <span>{pts(volume)} volume</span>
            {market.status === "OPEN" ? <span>closes in {timeUntil(market.closesAt)}</span> : null}
            {yourYes > 0 ? <span className="you">{Math.round(yourYes)} YES</span> : null}
            {yourNo > 0 ? <span className="you">{Math.round(yourNo)} NO</span> : null}
          </div>
        </>
      )}

      <div className="card-foot muted small">
        by {market.creator.name} · {market._count.comments} comments
      </div>
    </Link>
  );
}

function StatusPill({ status, outcome }: { status: string; outcome: string | null }) {
  if (status === "RESOLVED") {
    return (
      <span className={`pill ${outcome === "YES" ? "pill-yes" : "pill-no"}`}>Resolved {outcome}</span>
    );
  }
  const cls: Record<string, string> = {
    PROPOSED: "pill-warn",
    OPEN: "pill-open",
    CLOSED: "pill-muted",
  };
  const label: Record<string, string> = {
    PROPOSED: "Needs approval",
    OPEN: "Open",
    CLOSED: "Awaiting result",
  };
  return <span className={`pill ${cls[status] ?? ""}`}>{label[status] ?? status}</span>;
}
