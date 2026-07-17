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
3. **The results film**: when the tournament is over, press
   *“🎬 Play results film on big screen”* — placements are revealed one at a
   time from last place, ending with the top-3 podium and confetti.

> **Important:** There is no database. State is stored in the browser's
> localStorage and synced live between tabs/windows in the **same browser on
> the same computer**. Run both the control panel and the big screen from
> the computer connected to the big screen. Data survives page reloads.

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
