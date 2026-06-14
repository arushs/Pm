import { PrismaClient } from "@prisma/client";
import { quoteBuy, type Side } from "../src/lib/amm";
import { LIQUIDITY } from "../src/lib/config";

const prisma = new PrismaClient();
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "arushshankar@gmail.com").toLowerCase();

type BetSpec = { userId: string; side: Side; amount: number };

async function debit(userId: string, amount: number) {
  await prisma.user.update({ where: { id: userId }, data: { balance: { decrement: amount } } });
}

/** Replays bets through the market maker so seeded pools and shares stay consistent. */
function simulate(bets: BetSpec[]) {
  let yes = LIQUIDITY;
  let no = LIQUIDITY;
  const rows = bets.map((b) => {
    const q = quoteBuy(yes, no, b.side, b.amount);
    yes = q.newYes;
    no = q.newNo;
    return { userId: b.userId, side: b.side, amount: b.amount, shares: q.shares };
  });
  return { yes, no, rows };
}

async function main() {
  const members = [
    { name: "Arush", email: ADMIN_EMAIL, isAdmin: true },
    { name: "Nandita", email: "nandita@example.com" },
    { name: "George", email: "george@example.com" },
    { name: "Royce", email: "royce@example.com" },
    { name: "Suvir", email: "suvir@example.com" },
    { name: "Tiger", email: "tiger@example.com" },
  ];

  const users = [];
  for (const m of members) {
    const u = await prisma.user.upsert({
      where: { email: m.email },
      update: { name: m.name, isAdmin: !!m.isAdmin },
      create: { email: m.email, name: m.name, isAdmin: !!m.isAdmin, balance: 1000 },
    });
    users.push(u);
  }
  const [arush, nandita, george, royce, suvir, tiger] = users;

  if ((await prisma.market.count()) === 0) {
    const now = Date.now();
    const day = 86_400_000;

    // 1) Open market with live trades.
    const sim1 = simulate([
      { userId: arush.id, side: "YES", amount: 200 },
      { userId: nandita.id, side: "NO", amount: 150 },
      { userId: suvir.id, side: "NO", amount: 100 },
    ]);
    await prisma.market.create({
      data: {
        title: "Will it rain in Brooklyn this Saturday?",
        description: "Resolves YES if there is measurable precipitation in Brooklyn on Saturday.",
        category: "Weather",
        status: "OPEN",
        closesAt: new Date(now + 2 * day),
        openedAt: new Date(now - day),
        creatorId: george.id,
        liquidity: LIQUIDITY,
        yesPool: sim1.yes,
        noPool: sim1.no,
        approvals: { create: [{ userId: george.id }, { userId: arush.id }, { userId: royce.id }] },
        bets: { create: sim1.rows },
      },
    });
    for (const r of sim1.rows) await debit(r.userId, r.amount);

    // 2) Proposed market awaiting approval (no trades yet).
    await prisma.market.create({
      data: {
        title: "Will the group hit 20 members by July 1?",
        description: "Resolves YES if Hunch has at least 20 members on July 1.",
        category: "Meta",
        status: "PROPOSED",
        closesAt: new Date(now + 14 * day),
        creatorId: royce.id,
        liquidity: LIQUIDITY,
        yesPool: LIQUIDITY,
        noPool: LIQUIDITY,
        approvals: { create: [{ userId: royce.id }] },
      },
    });

    // 3) Closed market awaiting admin resolution.
    const sim3 = simulate([
      { userId: tiger.id, side: "YES", amount: 120 },
      { userId: george.id, side: "NO", amount: 80 },
    ]);
    await prisma.market.create({
      data: {
        title: "Did the home team win last night?",
        description: "Resolves YES if the home team won their most recent game.",
        category: "Sports",
        status: "CLOSED",
        closesAt: new Date(now - day),
        openedAt: new Date(now - 3 * day),
        creatorId: tiger.id,
        liquidity: LIQUIDITY,
        yesPool: sim3.yes,
        noPool: sim3.no,
        approvals: { create: [{ userId: tiger.id }, { userId: arush.id }, { userId: george.id }] },
        bets: { create: sim3.rows },
      },
    });
    for (const r of sim3.rows) await debit(r.userId, r.amount);
  }

  console.log(`Seed complete: ${users.length} members.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
