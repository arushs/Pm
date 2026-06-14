import Link from "next/link";
import type { User } from "@prisma/client";
import { logout } from "@/app/actions";
import { pts } from "@/lib/format";
import { APP_NAME } from "@/lib/config";

export function Nav({ user, unread }: { user: User | null; unread: number }) {
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link href="/" className="brand">
          {APP_NAME}
        </Link>
        {user ? (
          <nav className="nav-links">
            <Link href="/">Markets</Link>
            <Link href="/markets/new">Propose</Link>
            <Link href="/leaderboard">Leaderboard</Link>
            <Link href="/notifications" className="notif-link">
              Alerts
              {unread > 0 ? <span className="badge">{unread}</span> : null}
            </Link>
            {user.isAdmin ? <Link href="/members">Members</Link> : null}
            <span className="balance">{pts(user.balance)}</span>
            <span className="who">{user.name}</span>
            <form action={logout}>
              <button className="link-btn" type="submit">
                Sign out
              </button>
            </form>
          </nav>
        ) : (
          <nav className="nav-links">
            <Link href="/login">Sign in</Link>
          </nav>
        )}
      </div>
    </header>
  );
}
