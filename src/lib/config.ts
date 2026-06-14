export const APP_NAME = "Hunch";
export const STARTING_BALANCE = 1000;
export const SESSION_COOKIE = "hunch_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, in seconds
export const MIN_APPROVALS = 2;

// Seed liquidity per side for the market maker. Higher = deeper market =
// smaller price moves per bet. Each market starts at 50% with yes = no = this.
export const LIQUIDITY = 250;

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/**
 * How many approvals are required to open a proposed market.
 * Defaults to a strict majority of all members; override with APPROVAL_QUORUM.
 */
export function requiredApprovals(memberCount: number): number {
  const raw = process.env.APPROVAL_QUORUM ? parseInt(process.env.APPROVAL_QUORUM, 10) : NaN;
  if (Number.isInteger(raw) && raw > 0) return raw;
  return Math.max(MIN_APPROVALS, Math.floor(memberCount / 2) + 1);
}
