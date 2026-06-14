# Hunch — a group prediction market

A play-money prediction market scoped for a small group (think a ~20-person group
chat). Members propose Yes/No markets, the group approves them by majority vote,
and everyone trades points against a **live-odds market maker** — prices move
continuously as people buy Yes or No. The admin resolves the outcome and winning
shares pay out. There's a price line per market, a leaderboard, and in-app + email
alerts.

Built with **Next.js 14 (App Router)**, **TypeScript**, **Prisma**, and
**SQLite for local dev / Postgres for production**. No real money involved.

---

## How it works

### The model
- **Play money.** Everyone starts with **1,000 points**. No real currency, no payments, no gambling-law headaches.
- **Live odds via a CPMM market maker.** Each market is an automated market maker holding a pool of YES shares and NO shares with a constant-product invariant (`yesPool * noPool = k`, Manifold-style). The **price of a YES share equals the implied probability**:
  ```
  probYes = noPool / (yesPool + noPool)
  ```
  - Buying YES pushes the price (and probability) **up**; buying NO pushes it down. Bigger bets move it more (slippage).
  - Each market seeds with `LIQUIDITY` shares per side (default **250**, in `src/lib/config.ts`) so it starts at 50%. More liquidity = a deeper market = smaller moves per bet.
  - Every **share pays 1 point** if the market resolves on its side, 0 otherwise. Your profit on a winning bet = `shares - pointsSpent`.
  - The seed liquidity slightly **subsidizes** payouts (exactly like Manifold). This is the only place besides bets where points enter the economy, and it's bounded per market.
- **Majority approval.** A proposed market needs a **majority of members** to approve it before trading opens (`floor(members / 2) + 1`, minimum 2; override with `APPROVAL_QUORUM`). The proposer auto-approves.
- **Admin resolution.** Once trading closes, the **admin** (you) picks the real-world outcome (Yes/No) and the app pays winning shares.
- **Notifications.** In-app alerts for everything; **email** for the two that matter — *a market needs your approval* and *a market you traded resolved*.

### Market lifecycle
```
PROPOSED  ──(majority approves)──▶  OPEN  ──(deadline passes)──▶  CLOSED  ──(admin resolves)──▶  RESOLVED
```

### Pages
| Route | What it does |
|---|---|
| `/` | All markets, grouped by status. Live probability, volume, your position. |
| `/markets/new` | Propose a Yes/No market with resolution criteria + close time. |
| `/markets/[id]` | Market detail: live probability + price line, your share holdings, a trade form that previews shares/slippage, admin resolve, trade history, discussion. |
| `/leaderboard` | Members ranked by point balance. |
| `/notifications` | Your alert feed. |
| `/members` | (admin) Add members; they sign in with their email. |
| `/login` | Magic-link sign-in. |

---

## Run it locally (zero external services)

Requires Node 18.18+ (Node 20 recommended).

```bash
# 1. install
npm install

# 2. env
cp .env.example .env
#    then set AUTH_SECRET to anything 16+ chars (e.g. `openssl rand -base64 32`)

# 3. create the SQLite db + seed demo data (6 members + 3 demo markets)
npm run db:push
npm run db:seed

# 4. run
npm run dev
# open http://localhost:3000
```

**Signing in locally:** there's no email provider in dev, so requesting a sign-in link
logs you in **instantly**. Use a seeded email, e.g. `arushshankar@gmail.com` (admin) or
`george@example.com` (regular member). Members are created by the admin on `/members`.

> Already ran an earlier version? The schema changed (market-maker pools + share
> counts), so run `npm run db:reset` to rebuild and re-seed.

> Want to test the magic-link email flow locally? Set `RESEND_API_KEY` and the app will
> email the link instead of auto-signing-in (the link is also printed to the server console).

### Useful scripts
- `npm run db:reset` — wipe + re-seed the database.
- `npm run db:seed` — (re)seed members and demo markets.
- `npm run build` / `npm start` — production build.

---

## Deploy to production (Vercel + Postgres)

SQLite won't persist on serverless hosts, so production uses Postgres (Neon, Supabase, or any Postgres).

1. **Create a Postgres database.** Free options: [Neon](https://neon.tech) or [Supabase](https://supabase.com). Copy the connection string.
2. **Switch Prisma to Postgres.** In `prisma/schema.prisma`, change:
   ```prisma
   datasource db {
     provider = "postgresql"   // was "sqlite"
     url      = env("DATABASE_URL")
   }
   ```
3. **Push the schema + seed** against the new DB:
   ```bash
   DATABASE_URL="postgresql://..." npx prisma db push
   DATABASE_URL="postgresql://..." ADMIN_EMAIL="you@example.com" npm run db:seed
   ```
4. **Deploy on Vercel.** Import the repo and set Environment Variables:
   | Var | Value |
   |---|---|
   | `DATABASE_URL` | your Postgres connection string |
   | `AUTH_SECRET` | `openssl rand -base64 32` |
   | `APP_URL` | your deployed URL, e.g. `https://hunch.vercel.app` |
   | `RESEND_API_KEY` | (optional) for real emails — get one at resend.com |
   | `EMAIL_FROM` | e.g. `Hunch <noreply@yourdomain.com>` |
   | `ADMIN_EMAIL` | your email (becomes admin on seed) |
   | `APPROVAL_QUORUM` | (optional) fixed number of approvals to open a market |
5. **Cron.** `vercel.json` registers a 30-min cron at `/api/cron/close` to close markets past their deadline.
   (The app also closes markets lazily on read, so this is just a backstop.)

### Real email
Set `RESEND_API_KEY` + `EMAIL_FROM`. Magic-link sign-in emails and the two key
notification emails (approval requests, resolutions) then send via Resend. Without a key,
everything still works — links auto-sign-in in dev and notification emails are logged.

---

## Architecture notes

- **Market maker** lives in `src/lib/amm.ts` as pure functions (`probYes`, `quoteBuy`, `probabilityHistory`) with no database imports, so the same pricing math runs server-side (to fill trades) and client-side (to preview shares/slippage in the bet form) and to draw the price line.
- **Auth:** passwordless magic links. A short-lived `LoginToken` is emailed (or auto-followed in dev); the verify route sets a signed JWT (`jose`) in an httpOnly cookie. Membership is closed — only emails the admin has added can sign in.
- **Money integrity:** placing a trade debits your balance, mints shares, and moves the pools inside a single transaction; resolution pays winning shares inside a transaction. Payouts floor to whole points.
- **Server Actions** handle all mutations (propose / approve / trade / resolve / comment / invite); pages are server components reading straight from Prisma.

## Roadmap ideas (not built yet)
- **Sell / cash-out** of share positions before resolution (currently you can hedge by buying the other side).
- Peer-to-peer **limit orders** at custom odds.
- Community/majority **resolution** (vote on the outcome) with a dispute window.
- Liquidity provider accounting (let members fund liquidity and earn the spread).
- Web push notifications; closing-soon reminders.

---

Made for a group of friends. Have fun, and don't bet your whole stack on the weather.
