# FootballHub

https://football-tournament-drab.vercel.app/

A no-login football tournament manager. Organizers create a tournament with a
password (no account); teams join with a name + password of their own choosing.
Everything else — group draws, fixtures, standings, score confirmation,
knockout brackets — is handled automatically.

Stack: **React (Vite)** frontend, **Node.js + Express** API, **MongoDB** (Mongoose).

## Project layout

```
footballhub/
  backend/     Express API + MongoDB models + core tournament logic
  frontend/    React app (Vite)
```

## 1. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:
- `MONGODB_URI` — a MongoDB connection string. Easiest option: a free
  [MongoDB Atlas](https://www.mongodb.com/atlas) cluster, or `mongodb://localhost:27017/footballhub`
  if you have MongoDB running locally.
- `JWT_SECRET` — any long random string (used to sign login sessions).
- `CORS_ORIGIN` — the frontend's URL (defaults to `http://localhost:5173`, Vite's default).

Run it:
```bash
npm run dev
```
The API starts on `http://localhost:4000` (health check at `/api/health`).

## 2. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_URL should point at your backend
npm run dev
```
Opens on `http://localhost:5173`.

## How access works (no accounts, no email)

- **Organizer**: picks a password when creating the tournament. Visiting
  `/t/<TOURNAMENT_ID>/admin` asks for that password, then issues a signed
  session token (stored in the browser) valid for 30 days.
- **Team**: registers with a team name + a password *they* choose at
  `/t/<TOURNAMENT_ID>/join`. Returning later, they log in with that same
  name + password from the same page.
- **Public**: `/t/<TOURNAMENT_ID>` is a read-only page — fixtures, standings,
  and the knockout bracket — no password needed.

## Core logic (backend/src/lib) — the parts worth understanding before extending

- **`fixtures.js`** — random group assignment + round-robin scheduling via the
  "circle method," with bye-handling for odd-sized groups.
- **`standings.js`** — Points → Goal Difference → Goals For → Head-to-head,
  where head-to-head is a last-resort tiebreak recomputed only among teams
  still exactly tied (not a global sort key).
- **`knockout.js`** — builds a strongest-to-weakest seed list from group
  results, pairs seed 1 vs. the weakest seed and so on (standard tournament
  seeding), gives byes to the top seeds when the qualifier count isn't a
  power of two, and makes a best-effort pass to avoid same-group opponents in
  round 1. Rounds advance automatically as each match is confirmed.
- **`matchState.js`** — the score confirmation state machine: submit → the
  other side confirms, OR 30 minutes pass with no response (auto-confirm), OR
  the organizer approves it directly. A mismatched second submission raises a
  dispute that only the organizer can resolve.
- **`validation.js`** — guardrails: no duplicate team names, can't start with
  too few teams for the chosen group count, warns on uneven group sizes,
  and flags standings still tied after every automatic tiebreaker (the
  organizer can then schedule a manual playoff decider — `POST /playoff`).

## Known simplifications (documented, not hidden)

- **Auto-confirm timing**: the 30-minute auto-confirm is checked lazily
  (whenever matches are fetched), not by a server-side scheduled job. For a
  production deployment, add a small cron/worker that sweeps
  `pending_confirmation` matches past their window — the pure function
  (`autoConfirmIfDue`) is already there, it just needs a scheduler to call it
  independent of a page load.
- **No organizer password recovery**: since there's no email/account, a
  forgotten organizer password currently has no reset path. A reasonable
  addition: a one-time recovery code shown once at tournament creation
  (the same pattern used for team access in early drafts of this project).
- **Security model**: authorization is "knowing a password," not a user
  account — reasonable for a casual/free tool, but don't reuse this pattern
  for anything with real stakes. Passwords are hashed (bcrypt) at rest, and
  JWTs are scoped per-tournament/per-team so a token for one tournament can't
  be replayed against another.
- **Round 1 all-byes edge case**: if the qualifier count is small enough that
  every Round-1 "match" is a bye, advancement is triggered explicitly right
  after bracket generation (since no real match would otherwise fire the
  advance-check).

## Feature checklist against the brief

- ✅ No accounts — password-per-tournament, password-per-team
- ✅ Unique tournament ID + separate organizer/join links
- ✅ Duplicate team name prevention, pending/approve/reject flow
- ✅ Random balanced group assignment, round-robin fixtures
- ✅ Score submission by either team or organizer, confirm/dispute flow
- ✅ Standings with Points → GD → GF → Head-to-head → manual playoff decider
- ✅ Automatic knockout bracket generation + progression to Final
- ✅ Public read-only tournament page
- 🔜 Statistics page (most goals, biggest win, etc.) — not yet built; would
  read from the same `matches` collection, all the raw data is there.
- 🔜 Search page — not yet built.
- 🔜 Live score updates — current model is manual refresh; swapping to
  WebSockets or polling is a frontend-only change since the API shape
  wouldn't need to change.
