import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { lazyClose, isBettable } from "@/lib/market";
import { probYes, probabilityHistory } from "@/lib/amm";
import { requiredApprovals } from "@/lib/config";
import { pts, pct, fmtDate } from "@/lib/format";
import { BetForm } from "@/components/BetForm";
import { Sparkline } from "@/components/Sparkline";
import { approveMarket, resolveMarket, addComment } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function MarketPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { [k: string]: string | undefined };
}) {
  const user = await requireUser();
  const found = await prisma.market.findUnique({ where: { id: params.id } });
  if (!found) notFound();
  const market = await lazyClose(found);

  const [creator, bets, approvals, comments, memberCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: market.creatorId }, select: { name: true } }),
    prisma.bet.findMany({
      where: { marketId: market.id },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.marketApproval.findMany({
      where: { marketId: market.id },
      include: { user: { select: { name: true } } },
    }),
    prisma.comment.findMany({
      where: { marketId: market.id },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.count(),
  ]);

  const prob = probYes(market.yesPool, market.noPool);
  const volume = bets.reduce((s, b) => s + b.amount, 0);
  const betsAsc = [...bets].reverse();
  const history = probabilityHistory(market.liquidity, betsAsc);

  const yourYes = bets.filter((b) => b.userId === user.id && b.side === "YES").reduce((s, b) => s + b.shares, 0);
  const yourNo = bets.filter((b) => b.userId === user.id && b.side === "NO").reduce((s, b) => s + b.shares, 0);
  const yourSpent = bets.filter((b) => b.userId === user.id).reduce((s, b) => s + b.amount, 0);
  const yourValue = yourYes * prob + yourNo * (1 - prob);

  const youApproved = approvals.some((a) => a.userId === user.id);
  const need = requiredApprovals(memberCount);
  const bettable = isBettable(market);

  return (
    <div className="detail stack-lg">
      <Link href="/" className="back">
        &larr; All markets
      </Link>

      {searchParams.placed ? <div className="flash ok">Trade filled.</div> : null}
      {searchParams.resolved ? <div className="flash ok">Market resolved and winners paid.</div> : null}
      {searchParams.error ? <div className="flash err">{errMsg(searchParams.error)}</div> : null}

      <header className="detail-head">
        <span className="pill pill-cat">{market.category}</span>
        <h1>{market.title}</h1>
        {market.description ? <p className="muted">{market.description}</p> : null}
        <div className="muted small">
          Proposed by {creator?.name ?? "—"} · closes {fmtDate(market.closesAt)}
          {market.resolvesAt ? ` · resolves ~${fmtDate(market.resolvesAt)}` : ""}
        </div>
      </header>

      {market.status !== "PROPOSED" && (
        <section className="panel">
          <div className="prob-head">
            <div>
              <span className="prob-xl">{pct(prob)}</span>
              <span className="muted"> chance of Yes</span>
            </div>
            <div className="muted small">
              {pts(volume)} volume · {bets.length} trades
            </div>
          </div>
          <Sparkline points={history} />
          <div className="odds-labels">
            <span className="yes">Yes {pct(prob)}</span>
            <span className="no">No {pct(1 - prob)}</span>
          </div>
        </section>
      )}

      {(yourYes > 0 || yourNo > 0) && (
        <section className="panel holdings">
          <h2>Your position</h2>
          <div className="holding-row">
            {yourYes > 0 ? (
              <span className="chip">
                {Math.round(yourYes)} YES shares
              </span>
            ) : null}
            {yourNo > 0 ? (
              <span className="chip">
                {Math.round(yourNo)} NO shares
              </span>
            ) : null}
            <span className="muted small">
              spent {pts(yourSpent)}
              {market.status !== "RESOLVED" ? ` · current value ~${pts(Math.round(yourValue))}` : ""}
            </span>
          </div>
        </section>
      )}

      {market.status === "PROPOSED" && (
        <section className="panel">
          <h2>Approve this market</h2>
          <p className="muted small">
            {approvals.length}/{need} approvals needed to open betting.
          </p>
          <div className="progress">
            <div
              className="progress-bar"
              style={{ width: `${Math.min(100, (approvals.length / need) * 100)}%` }}
            />
          </div>
          <div className="chips">
            {approvals.map((a) => (
              <span key={a.id} className="chip">
                {a.user.name}
              </span>
            ))}
          </div>
          {!youApproved ? (
            <form action={approveMarket}>
              <input type="hidden" name="marketId" value={market.id} />
              <button className="btn btn-primary" type="submit">
                Approve
              </button>
            </form>
          ) : (
            <p className="muted small">You approved. Waiting on the rest of the group.</p>
          )}
        </section>
      )}

      {(market.status === "OPEN" || market.status === "CLOSED") && (
        <section className="panel">
          <h2>Trade</h2>
          {bettable ? (
            <BetForm marketId={market.id} yesPool={market.yesPool} noPool={market.noPool} balance={user.balance} />
          ) : (
            <p className="muted">
              Trading is closed{market.status === "CLOSED" ? " — awaiting resolution." : "."}
            </p>
          )}
        </section>
      )}

      {user.isAdmin && market.status === "CLOSED" && (
        <section className="panel admin">
          <h2>Resolve outcome (admin)</h2>
          <p className="muted small">Pick the real-world result. Winning shares pay 1 pt each.</p>
          <div className="row">
            <form action={resolveMarket}>
              <input type="hidden" name="marketId" value={market.id} />
              <input type="hidden" name="outcome" value="YES" />
              <button className="btn btn-yes" type="submit">
                Resolve YES
              </button>
            </form>
            <form action={resolveMarket}>
              <input type="hidden" name="marketId" value={market.id} />
              <input type="hidden" name="outcome" value="NO" />
              <button className="btn btn-no" type="submit">
                Resolve NO
              </button>
            </form>
          </div>
        </section>
      )}

      {market.status === "RESOLVED" && (
        <section className={`panel result ${market.outcome === "YES" ? "yes" : "no"}`}>
          <h2>Resolved {market.outcome}</h2>
          {yourYes > 0 || yourNo > 0 ? (
            <ResolvedYou spent={yourSpent} won={market.outcome === "YES" ? yourYes : yourNo} />
          ) : (
            <p className="muted">You did not trade on this one.</p>
          )}
        </section>
      )}

      {bets.length > 0 && (
        <section className="panel">
          <h2>Trades</h2>
          <ul className="bets">
            {bets.map((b) => (
              <li key={b.id} className="bet-row">
                <span>{b.user.name}</span>
                <span className={b.side === "YES" ? "yes" : "no"}>{b.side}</span>
                <span>{pts(b.amount)}</span>
                <span className="muted small">@ {(b.shares > 0 ? b.amount / b.shares : 0).toFixed(2)}</span>
                {market.status === "RESOLVED" ? (
                  <span className="muted">{b.payout && b.payout > 0 ? `+${pts(b.payout)}` : "—"}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel">
        <h2>Discussion ({comments.length})</h2>
        <ul className="comments">
          {comments.map((c) => (
            <li key={c.id}>
              <div>
                <strong>{c.user.name}</strong>{" "}
                <span className="muted small">{fmtDate(c.createdAt)}</span>
              </div>
              <p>{c.body}</p>
            </li>
          ))}
          {comments.length === 0 ? <li className="muted">No comments yet.</li> : null}
        </ul>
        <form action={addComment} className="comment-form">
          <input type="hidden" name="marketId" value={market.id} />
          <input name="body" placeholder="Add a comment..." maxLength={1000} required />
          <button className="btn" type="submit">
            Post
          </button>
        </form>
      </section>
    </div>
  );
}

function ResolvedYou({ spent, won }: { spent: number; won: number }) {
  const payout = Math.floor(won);
  const net = payout - spent;
  return (
    <p className={net >= 0 ? "yes" : "no"}>
      You spent {pts(spent)} and your winning shares paid {pts(payout)} (net {net >= 0 ? "+" : ""}
      {pts(net)}).
    </p>
  );
}

function errMsg(code: string): string {
  const m: Record<string, string> = {
    amount: "Enter a valid amount.",
    funds: "You do not have enough points for that trade.",
    closed: "Trading has closed on this market.",
    side: "Pick Yes or No.",
    outcome: "Pick an outcome.",
    notclosed: "A market must be closed before it can be resolved.",
  };
  return m[code] ?? "Something went wrong.";
}
