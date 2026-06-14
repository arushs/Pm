import { requireUser } from "@/lib/auth";
import { proposeMarket } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function NewMarket({
  searchParams,
}: {
  searchParams: { [k: string]: string | undefined };
}) {
  await requireUser();

  return (
    <div className="stack-lg narrow">
      <div>
        <h1>Propose a market</h1>
        <p className="muted">It opens for betting once a majority of members approve it.</p>
      </div>

      {searchParams.error === "closesAt" ? (
        <div className="flash err">Pick a betting close time in the future.</div>
      ) : null}
      {searchParams.error === "invalid" ? (
        <div className="flash err">Check the title and fields and try again.</div>
      ) : null}

      <form action={proposeMarket} className="form stack">
        <label className="field">
          <span>Question (Yes / No)</span>
          <input name="title" placeholder="Will X happen by Y?" required minLength={4} maxLength={140} />
        </label>

        <label className="field">
          <span>Resolution criteria</span>
          <textarea
            name="description"
            rows={4}
            placeholder="Describe exactly how this resolves YES vs NO, and the source of truth."
          />
        </label>

        <div className="row">
          <label className="field">
            <span>Category</span>
            <input name="category" placeholder="Sports, Weather, Meta..." defaultValue="General" />
          </label>
          <label className="field">
            <span>Betting closes</span>
            <input name="closesAt" type="datetime-local" required />
          </label>
          <label className="field">
            <span>Expected resolution (optional)</span>
            <input name="resolvesAt" type="datetime-local" />
          </label>
        </div>

        <button className="btn btn-primary" type="submit">
          Submit for approval
        </button>
      </form>
    </div>
  );
}
