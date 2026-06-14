import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pts } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Leaderboard() {
  const me = await requireUser();
  const users = await prisma.user.findMany({
    orderBy: { balance: "desc" },
    include: { bets: { select: { amount: true } } },
  });

  return (
    <div className="stack-lg">
      <div>
        <h1>Leaderboard</h1>
        <p className="muted">Ranked by current point balance.</p>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Member</th>
            <th>Balance</th>
            <th>Bets</th>
            <th>Wagered</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u, i) => {
            const wagered = u.bets.reduce((s, b) => s + b.amount, 0);
            return (
              <tr key={u.id} className={u.id === me.id ? "me" : ""}>
                <td>{i + 1}</td>
                <td>
                  {u.name}
                  {u.isAdmin ? <span className="tag">admin</span> : null}
                </td>
                <td>{pts(u.balance)}</td>
                <td>{u.bets.length}</td>
                <td>{pts(wagered)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
