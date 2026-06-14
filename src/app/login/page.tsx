import { redirect } from "next/navigation";
import { requestLogin } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Login({
  searchParams,
}: {
  searchParams: { [k: string]: string | undefined };
}) {
  if (await getCurrentUser()) redirect("/");

  return (
    <div className="auth">
      <h1>Hunch</h1>
      <p className="muted">A play-money prediction market for your group.</p>

      {searchParams.sent ? <div className="flash ok">Check your email for a sign-in link.</div> : null}
      {searchParams.error === "notfound" ? (
        <div className="flash err">No member with that email. Ask an admin to add you.</div>
      ) : null}
      {searchParams.error === "expired" ? (
        <div className="flash err">That link expired or was already used. Request a new one.</div>
      ) : null}
      {searchParams.error === "missing" ? <div className="flash err">Enter your email.</div> : null}

      <form action={requestLogin} className="auth-form">
        <input name="email" type="email" placeholder="you@example.com" required autoFocus />
        <button className="btn btn-primary full" type="submit">
          Send sign-in link
        </button>
      </form>
      <p className="muted small">
        Dev mode (no email provider configured) signs you in instantly. Seeded admin:
        arushshankar@gmail.com
      </p>
    </div>
  );
}
