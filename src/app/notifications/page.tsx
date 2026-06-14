import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { markAllRead } from "@/app/actions";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Notifications() {
  const user = await requireUser();
  const items = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="stack-lg">
      <div className="hero">
        <h1>Alerts</h1>
        <form action={markAllRead}>
          <button className="btn" type="submit">
            Mark all read
          </button>
        </form>
      </div>

      <ul className="notif-list">
        {items.map((n) => (
          <li key={n.id} className={n.read ? "" : "unread"}>
            <div className="notif-main">
              <strong>
                {n.marketId ? <Link href={`/markets/${n.marketId}`}>{n.title}</Link> : n.title}
              </strong>
              {n.body ? <p className="muted small">{n.body}</p> : null}
            </div>
            <span className="muted small">{fmtDate(n.createdAt)}</span>
          </li>
        ))}
        {items.length === 0 ? <li className="muted">No alerts yet.</li> : null}
      </ul>
    </div>
  );
}
