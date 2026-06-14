"use server";

import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireAdmin } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { notify, notifyMany } from "@/lib/notifications";
import { lazyClose, settleMarket, isBettable } from "@/lib/market";
import { SESSION_COOKIE, STARTING_BALANCE, requiredApprovals, appUrl } from "@/lib/config";

function randomToken(): string {
  return randomBytes(24).toString("hex");
}

/* ------------------------------ Auth ------------------------------ */

export async function requestLogin(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email) redirect("/login?error=missing");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) redirect("/login?error=notfound");

  const token = randomToken();
  await prisma.loginToken.create({
    data: { email, token, expiresAt: new Date(Date.now() + 1000 * 60 * 30) },
  });
  const verifyUrl = `${appUrl()}/api/auth/verify?token=${token}`;

  if (process.env.RESEND_API_KEY) {
    await sendEmail({
      to: email,
      subject: "Your Hunch sign-in link",
      html: `<p>Click to sign in to Hunch:</p>
             <p><a href="${verifyUrl}">${verifyUrl}</a></p>
             <p style="color:#888">This link expires in 30 minutes.</p>`,
    });
    redirect("/login?sent=1");
  }
  // Dev mode (no email provider): sign in directly via the verify route.
  redirect(verifyUrl);
}

export async function logout() {
  cookies().delete(SESSION_COOKIE);
  redirect("/login");
}

/* --------------------------- Markets --------------------------- */

const ProposeSchema = z.object({
  title: z.string().trim().min(4).max(140),
  description: z.string().max(2000).optional().default(""),
  category: z.string().max(40).optional().default("General"),
  closesAt: z.string().min(1),
  resolvesAt: z.string().optional().default(""),
});

export async function proposeMarket(formData: FormData) {
  const user = await requireUser();
  const parsed = ProposeSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    category: formData.get("category") ?? "General",
    closesAt: formData.get("closesAt"),
    resolvesAt: formData.get("resolvesAt") ?? "",
  });
  if (!parsed.success) redirect("/markets/new?error=invalid");

  const data = parsed.data;
  const closesAt = new Date(data.closesAt);
  if (isNaN(closesAt.getTime()) || closesAt.getTime() <= Date.now()) {
    redirect("/markets/new?error=closesAt");
  }
  const resolvesParsed = data.resolvesAt ? new Date(data.resolvesAt) : null;
  const resolvesAt = resolvesParsed && !isNaN(resolvesParsed.getTime()) ? resolvesParsed : null;

  const market = await prisma.market.create({
    data: {
      title: data.title,
      description: data.description ?? "",
      category: data.category?.trim() || "General",
      status: "PROPOSED",
      closesAt,
      resolvesAt,
      creatorId: user.id,
      liquidity: LIQUIDITY,
      yesPool: LIQUIDITY,
      noPool: LIQUIDITY,
      approvals: { create: { userId: user.id } }, // proposer auto-approves
    },
  });

  const others = await prisma.user.findMany({
    where: { id: { not: user.id } },
    select: { id: true },
  });
  await notifyMany(
    others.map((u) => u.id),
    {
      type: "MARKET_PROPOSED",
      title: `New market needs approval: ${data.title}`,
      body: `${user.name} proposed a market. Review it and approve to open betting.`,
      marketId: market.id,
      email: true,
    },
  );

  revalidatePath("/");
  redirect(`/markets/${market.id}`);
}

export async function approveMarket(formData: FormData) {
  const user = await requireUser();
  const marketId = String(formData.get("marketId") || "");
  const market = await prisma.market.findUnique({ where: { id: marketId } });
  if (!market || market.status !== "PROPOSED") return;

  await prisma.marketApproval.upsert({
    where: { marketId_userId: { marketId, userId: user.id } },
    update: {},
    create: { marketId, userId: user.id },
  });

  const [approvalCount, memberCount] = await Promise.all([
    prisma.marketApproval.count({ where: { marketId } }),
    prisma.user.count(),
  ]);

  if (approvalCount >= requiredApprovals(memberCount)) {
    await prisma.market.update({
      where: { id: marketId },
      data: { status: "OPEN", openedAt: new Date() },
    });
    const members = await prisma.user.findMany({ select: { id: true } });
    await notifyMany(
      members.map((m) => m.id),
      {
        type: "MARKET_OPEN",
        title: `Market is live: ${market.title}`,
        body: "Betting is now open. Place your Yes or No bet.",
        marketId: market.id,
        email: false,
      },
    );
  }

  revalidatePath(`/markets/${marketId}`);
  revalidatePath("/");
}

export async function placeBet(formData: FormData) {
  const user = await requireUser();
  const marketId = String(formData.get("marketId") || "");
  const side = String(formData.get("side") || "");
  const amount = parseInt(String(formData.get("amount") || "0"), 10);

  if (side !== "YES" && side !== "NO") redirect(`/markets/${marketId}?error=side`);
  if (!Number.isInteger(amount) || amount <= 0) redirect(`/markets/${marketId}?error=amount`);

  const found = await prisma.market.findUnique({ where: { id: marketId } });
  if (!found) redirect("/");
  const market = await lazyClose(found);
  if (!isBettable(market)) redirect(`/markets/${marketId}?error=closed`);

  const fresh = await prisma.user.findUnique({ where: { id: user.id } });
  if (!fresh || fresh.balance < amount) redirect(`/markets/${marketId}?error=funds`);

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { balance: { decrement: amount } } }),
    prisma.bet.create({ data: { marketId, userId: user.id, side, amount } }),
  ]);

  revalidatePath(`/markets/${marketId}`);
  redirect(`/markets/${marketId}?placed=1`);
}

export async function resolveMarket(formData: FormData) {
  await requireAdmin();
  const marketId = String(formData.get("marketId") || "");
  const outcome = String(formData.get("outcome") || "");
  if (outcome !== "YES" && outcome !== "NO") redirect(`/markets/${marketId}?error=outcome`);

  const found = await prisma.market.findUnique({ where: { id: marketId } });
  if (!found) redirect("/");
  const market = await lazyClose(found);
  if (market.status !== "CLOSED") redirect(`/markets/${marketId}?error=notclosed`);

  const settlements = await settleMarket(marketId, outcome);

  await Promise.all(
    settlements.map((s) => {
      const net = s.payout - s.staked;
      const title =
        net > 0
          ? `You won on "${market.title}"`
          : net === 0
            ? `"${market.title}" resolved ${outcome}`
            : `You lost on "${market.title}"`;
      const body = `Resolved ${outcome}. You staked ${s.staked} pts and received ${s.payout} pts (net ${net >= 0 ? "+" : ""}${net}).`;
      return notify({ userId: s.userId, type: "MARKET_RESOLVED", title, body, marketId, email: true });
    }),
  );

  revalidatePath(`/markets/${marketId}`);
  revalidatePath("/");
  revalidatePath("/leaderboard");
  redirect(`/markets/${marketId}?resolved=1`);
}

export async function addComment(formData: FormData) {
  const user = await requireUser();
  const marketId = String(formData.get("marketId") || "");
  const body = String(formData.get("body") || "").trim();
  if (!body) return;
  await prisma.comment.create({
    data: { marketId, userId: user.id, body: body.slice(0, 1000) },
  });
  revalidatePath(`/markets/${marketId}`);
}

/* ------------------------ Notifications ------------------------ */

export async function markAllRead() {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { userId: user.id, read: false },
    data: { read: true },
  });
  revalidatePath("/notifications");
}

/* --------------------------- Members --------------------------- */

export async function inviteMember(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim();
  if (!email || !name) redirect("/members?error=missing");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) redirect("/members?error=exists");

  await prisma.user.create({ data: { email, name, balance: STARTING_BALANCE } });
  revalidatePath("/members");
  redirect("/members?added=1");
}
