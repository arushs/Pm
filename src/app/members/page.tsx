import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { inviteMember } from "@/app/actions";
import { pts } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Members({
  searchParams,
}: {
  searchParams: { [k: string]: string | undefined };
}) {
  await requireAdmin();
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="stack-lg">
      <h1>Members ({users.length})</h1>

      {searchParams.added ? <div className="flash ok">Member added.</div> : null}
      {searchParams.error === "exists" ? (
        <div className="flash err">That email is already a member.</div>
      ) : null}
      {searchParams.error === "missing" ? (
        <div className="flash err">Name and email are both required.</div>
      ) : null}

      <section className="panel">
        <h2>Add member</h2>
        <form action={inviteMember} className="row">
          <input name="name" placeholder="Name" required />
          <input name="email" type="email" placeholder="email@example.com" required />
          <button className="btn btn-primary" type="submit">
            Add
          </button>
        </form>
        <p className="muted small">New members start with {pts(1000)} and sign in with their email.</p>
      </section>

      <ul className="member-list">
        {users.map((u) => (
          <li key={u.id}>
            <span>
              {u.name}
              {u.isAdmin ? <span className="tag">admin</span> : null}
            </span>
            <span className="muted">{u.email}</span>
            <span>{pts(u.balance)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
