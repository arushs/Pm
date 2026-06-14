"use client";

import { useState } from "react";
import { placeBet } from "@/app/actions";
import { quoteBuy, probYes } from "@/lib/amm";

export function BetForm({
  marketId,
  yesPool,
  noPool,
  balance,
}: {
  marketId: string;
  yesPool: number;
  noPool: number;
  balance: number;
}) {
  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [amount, setAmount] = useState<number>(100);

  const stake = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const currentProb = probYes(yesPool, noPool);
  const quote = quoteBuy(yesPool, noPool, side, stake);
  const payoutIfWin = Math.floor(quote.shares);
  const profit = payoutIfWin - stake;
  const tooMuch = stake > balance;

  return (
    <form action={placeBet} className="bet-form">
      <input type="hidden" name="marketId" value={marketId} />
      <input type="hidden" name="side" value={side} />

      <div className="side-toggle">
        <button
          type="button"
          className={`side-btn yes ${side === "YES" ? "active" : ""}`}
          onClick={() => setSide("YES")}
        >
          Yes · {Math.round(currentProb * 100)}%
        </button>
        <button
          type="button"
          className={`side-btn no ${side === "NO" ? "active" : ""}`}
          onClick={() => setSide("NO")}
        >
          No · {Math.round((1 - currentProb) * 100)}%
        </button>
      </div>

      <label className="field">
        <span>Amount (pts)</span>
        <input
          type="number"
          name="amount"
          min={1}
          max={balance}
          step={1}
          value={Number.isFinite(amount) ? amount : ""}
          onChange={(e) => setAmount(parseInt(e.target.value || "0", 10))}
        />
      </label>

      <div className="quick">
        {[50, 100, 250, 500].map((v) => (
          <button type="button" key={v} className="chip-btn" onClick={() => setAmount(v)}>
            {v}
          </button>
        ))}
        <button type="button" className="chip-btn" onClick={() => setAmount(balance)}>
          Max
        </button>
      </div>

      <div className="payout-preview">
        <div>
          Buy <strong>{Math.round(quote.shares)} {side}</strong> shares @ avg{" "}
          <strong>{quote.avgPrice.toFixed(2)}</strong>
        </div>
        <div>
          If <strong>{side}</strong> wins: <strong>{payoutIfWin.toLocaleString()} pts</strong>{" "}
          <span className={profit >= 0 ? "yes" : "no"}>
            ({profit >= 0 ? "+" : ""}
            {profit.toLocaleString()})
          </span>
        </div>
        <div className="muted small">
          Moves Yes {Math.round(currentProb * 100)}% &rarr; {Math.round(quote.newProbYes * 100)}% ·
          balance {balance.toLocaleString()} pts
        </div>
      </div>

      <button className="btn btn-primary full" type="submit" disabled={stake <= 0 || tooMuch}>
        {tooMuch ? "Not enough points" : `Buy ${side}`}
      </button>
    </form>
  );
}
