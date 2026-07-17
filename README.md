# Ranum Summer School Poker 🃏

Tournament manager for the Ranum Summer School poker tournament — no
database, ready for Vercel.

## How to use

1. **The control panel** is on the front page (`/`). Run everything from here:
   - **Players**: paste names (one per line) or upload a `.txt`/`.csv` file.
   - **Tables**: create tables with a name and number of seats, then press
     *“🎲 Random seat draw”* to seat everyone.
   - **Out**: when a player is knocked out, press *“Out”* — the placement is
     recorded automatically (the first player out gets last place). Press
     *“Undo”* if you mis-clicked.
   - **Blinds**: the clock counts down and raises the blinds automatically at
     each level change. You can also switch manually with *“Next level”* and
     edit the whole structure.
2. **The big screen** opens with the *“Open big screen ↗”* button (or go to
   `/display`). Drag the window to the big screen/projector and press `F11`
   for fullscreen. It updates live while you run things from the control
   panel, and shows a standings list of everyone knocked out and their
   placements.
3. **Dealer links**: every table card in the control panel has a unique
   link (`/table/<id>`) with a *Copy link* button. Open it on the dealer's
   phone — they see their table's players and can mark knockouts (with an
   Undo button) directly from the phone.
4. **The results film**: when the tournament is over, press
   *“🎬 Play results film on big screen”* — placements are revealed one at a
   time from last place, ending with the top-3 podium and confetti.

## Multi-device sync (for dealer phones)

Out of the box, state lives in the browser's localStorage and syncs live
between tabs/windows in the **same browser on the same computer** — enough
for control panel + big screen. The header shows *“This computer only”*.

To let dealer phones (and any other device) join, add server storage to
the Vercel project. Two options are auto-detected:

**Option A — Vercel Blob (fastest, no external provider):**

1. In the Vercel dashboard open your project → **Storage** →
   **Create Database** → choose **Blob** → Create and connect it to the
   project (auto-adds `BLOB_READ_WRITE_TOKEN`).
2. Redeploy (Deployments → ⋯ → Redeploy).

**Option B — Upstash for Redis (marketplace, also free):**

1. **Storage** → **Create Database** → under Marketplace providers choose
   **Upstash** → **Upstash for Redis** (free plan) and connect it
   (auto-adds `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`;
   `KV_REST_API_URL`/`KV_REST_API_TOKEN` also work).
2. Redeploy.

Either way the header then shows *“Multi-device sync on”*, and all
devices sync within ~2 seconds. Simultaneous knockouts from several
dealers are merged so nothing is lost. If both are configured, Redis is
preferred. (Note: an **Edge Config** store does NOT work — it is a
read-only config store.)

## Fixed setup in code

The default setup lives in [`data/config.ts`](data/config.ts): the
tournament title, pre-registered players, pre-created tables and the blind
structure. Edit the file and redeploy to have everything ready in advance.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel

Import the repo on [vercel.com](https://vercel.com) — it is a standard
Next.js app, so nothing needs to be configured. No environment variables,
no database.
