import type { Market } from "@prisma/client";
import { prisma } from "./db";
import type { Side } from "./amm";

export function isBettable(market: Pick<Market, "status" | "closesAt">): boolean {
  return market.status === "OPEN" && market.closesAt.getTime() > Date.now();
}

/** Flip a single OPEN market to CLOSED if its deadline has passed. */
export async function lazyClose(market: Market): Promise<Market> {
  if (market.status === "OPEN" && market.closesAt.getTime() <= Date.now()) {
    return prisma.market.update({ where: { id: market.id }, data: { status: "CLOSED" } });
  }
  return market;
}

/** Bulk-close every OPEN market past its deadline. Returns the count closed. */
export async function closeExpiredMarkets(): Promise<number> {
  const res = await prisma.market.updateMany({
    where: { status: "OPEN", closesAt: { lte: new Date() } },
    data: { status: "CLOSED" },
  });
  return res.count;
}

/**
 * Resolve a market and pay out winning shares (1 point per share, floored).
 * The market maker subsidizes payouts via its seed liquidity, so winners can
 * collectively receive slightly more than was wagered — this is the only place
 * (besides bets) where points enter the economy, and it is bounded per market.
 * Returns per-user settlement so the caller can send notifications.
 */
export async function settleMarket(
  marketId: string,
  outcome: Side,
): Promise<{ userId: string; staked: number; payout: number }[]> {
  return prisma.$transaction(async (tx) => {
    const bets = await tx.bet.findMany({ where: { marketId } });
    const byUser = new Map<string, { staked: number; payout: number }>();

    for (const bet of bets) {
      const payout = bet.side === outcome ? Math.floor(bet.shares) : 0;
      await tx.bet.update({ where: { id: bet.id }, data: { payout } });
      if (payout > 0) {
        await tx.user.update({
          where: { id: bet.userId },
          data: { balance: { increment: payout } },
        });
      }
      const cur = byUser.get(bet.userId) ?? { staked: 0, payout: 0 };
      cur.staked += bet.amount;
      cur.payout += payout;
      byUser.set(bet.userId, cur);
    }

    await tx.market.update({
      where: { id: marketId },
      data: { status: "RESOLVED", outcome, resolvedAt: new Date() },
    });

    return Array.from(byUser.entries()).map(([userId, v]) => ({ userId, ...v }));
  });
}
