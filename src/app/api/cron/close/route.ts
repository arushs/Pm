import { NextResponse } from "next/server";
import { closeExpiredMarkets } from "@/lib/market";

export const dynamic = "force-dynamic";

// Hit by Vercel Cron (see vercel.json) to flip OPEN markets past their deadline
// to CLOSED. The app also closes markets lazily on read, so this is a backstop.
export async function GET() {
  const closed = await closeExpiredMarkets();
  return NextResponse.json({ ok: true, closed });
}
