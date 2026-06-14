// Pure constant-product market maker (CPMM, p = 0.5) for binary markets.
// No database imports here so this module is safe to use in client components.
//
// Model: the market holds a pool of YES shares (`yesPool`) and NO shares
// (`noPool`) with invariant yesPool * noPool = k. The price of a YES share
// equals the implied probability of YES:
//
//     probYes = noPool / (yesPool + noPool)
//
// Buying YES with M points mints M complete share-sets into both pools, then
// pays out the YES shares needed to restore the invariant. Each share pays 1
// point if the market resolves on its side, 0 otherwise. Share price always
// sits between 0 and 1 and equals probability at the margin.

export type Side = "YES" | "NO";

export function probYes(yesPool: number, noPool: number): number {
  const total = yesPool + noPool;
  return total > 0 ? noPool / total : 0.5;
}

export type Quote = {
  shares: number; // shares received
  newYes: number; // pool after the trade
  newNo: number;
  avgPrice: number; // points paid per share (0..1)
  newProbYes: number; // implied probability after the trade
};

export function quoteBuy(yesPool: number, noPool: number, side: Side, amount: number): Quote {
  if (!(amount > 0)) {
    return {
      shares: 0,
      newYes: yesPool,
      newNo: noPool,
      avgPrice: 0,
      newProbYes: probYes(yesPool, noPool),
    };
  }

  const k = yesPool * noPool;
  let newYes: number;
  let newNo: number;
  let shares: number;

  if (side === "YES") {
    newNo = noPool + amount;
    newYes = k / newNo;
    shares = yesPool + amount - newYes;
  } else {
    newYes = yesPool + amount;
    newNo = k / newYes;
    shares = noPool + amount - newNo;
  }

  const avgPrice = shares > 0 ? amount / shares : 0;
  return { shares, newYes, newNo, avgPrice, newProbYes: probYes(newYes, newNo) };
}

// Replays trades (oldest first) from the seed liquidity to produce the implied
// probability after each trade. Used to draw the price line / sparkline.
export function probabilityHistory(
  liquidity: number,
  bets: { side: string; amount: number }[],
): number[] {
  let y = liquidity;
  let n = liquidity;
  const out = [probYes(y, n)];
  for (const b of bets) {
    const q = quoteBuy(y, n, b.side === "YES" ? "YES" : "NO", b.amount);
    y = q.newYes;
    n = q.newNo;
    out.push(q.newProbYes);
  }
  return out;
}
