# Teppanyaki Tonight — Instructor Setup

A single-player browser simulation for teaching operations management (batching,
capacity trade-offs, service time, demand management, policy customisation).
Students run a teppanyaki restaurant for one evening across six challenges; results
post to a live class leaderboard. Everything runs client-side — Firebase is used
only for the leaderboard, reflections, and class settings.

## 1. Clone & install

```bash
git clone <your-fork-url> teppanyaki-tonight
cd teppanyaki-tonight
npm install
```

## 2. Create a Firebase project (free Spark tier)

1. Create a project at <https://console.firebase.google.com>.
2. **Build → Firestore Database → Create database** (production mode).
3. **Project settings → General → Your apps → Web app** and copy the config values.
4. Paste the security rules from [`firestore.rules`](./firestore.rules) into
   **Firestore → Rules** and publish. (No auth — the class code namespaces all data;
   this is intentional for a frictionless classroom tool.)

## 3. Configure environment

Copy `.env.example` to `.env.local` and fill in the six values:

```bash
cp .env.example .env.local
```

```
VITE_FIREBASE_API_KEY=…
VITE_FIREBASE_AUTH_DOMAIN=…
VITE_FIREBASE_PROJECT_ID=…
VITE_FIREBASE_STORAGE_BUCKET=…
VITE_FIREBASE_MESSAGING_SENDER_ID=…
VITE_FIREBASE_APP_ID=…
```

> Without these values the app still runs in **demo mode** (simulation works; the
> leaderboard and reflection storage are disabled).

## 4. Create a class document

In Firestore, manually create a document at `classes/{YOUR_CLASS_CODE}` (e.g.
`classes/test1`) with these fields:

```json
{
  "createdAt": "<timestamp>",
  "instructorPin": "1234",
  "settings": {
    "reflectionsRequired": true,
    "autoDebrief": false,
    "utilizationVisible": false,
    "leaderboardMode": "challenge",
    "leaderboardMetric": "avgProfit",
    "lockChallenges": true,
    "activeLeaderboardChallenge": "batching"
  }
}
```

The instructor dashboard at `/admin` can edit everything under `settings` after that.

## 5. Run locally

```bash
npm run dev          # http://localhost:5173/teppanyaki-tonight/
npm run test:engine  # verifies the simulation's pedagogical conclusions
```

## 6. Deploy to GitHub Pages

1. Push to GitHub. In **Settings → Pages**, set **Source = GitHub Actions**.
2. Add the six `VITE_FIREBASE_*` values as **repository secrets**
   (Settings → Secrets and variables → Actions).
3. Push to `main` — the workflow in `.github/workflows/deploy.yml` builds and deploys to
   `https://{username}.github.io/teppanyaki-tonight/`.

> The app is served under the `/teppanyaki-tonight/` base path (see `vite.config.ts`
> and the router `basename`). If you rename the repo, update both.

## 7. Run the class

- Share the URL and the **class code** with students.
- Students enter the code + a display name, then work through the six challenges
  left to right. Each challenge unlocks the next when its result is submitted
  (disable via **Lock Challenges** in admin settings).
- **Instructor dashboard:** go to `{url}/admin`, enter the class code and PIN.
  - **Settings** — toggle reflections, auto-debrief, the utilisation meter, locking,
    and the leaderboard mode/metric/active challenge (all live-saved). Also includes
    **Economics & Calibration** (per-class overrides for dinner/drink margin, fixed
    cost, patience, default bar seats/tables — stored in an optional `params` map on
    the class doc; absent fields use engine defaults), **Change PIN**, and
    **Reset Class Data** (deletes all results + reflections; requires the `delete`
    rules in `firestore.rules`, so re-publish them if upgrading from iteration 1).
  - **Live Board** — projection view with **Theater Mode** and live updates.
  - **Results** / **Reflections** — filterable tables with CSV download for grading.

### Suggested in-class flow for the Batching challenge
Run it with the utilisation meter **hidden**. Let students discover that "no batching"
feels busy but loses money. Then flip **Utilisation Meter Visible** on in admin settings
to reveal *why*: the chef is a batch server, and half-empty tables waste half his capacity.

## New class section
Create another `classes/{code}` document with a different code and PIN. The same
deployment serves every section.

---

## Project layout

| Path | What |
|---|---|
| `src/engine/` | Pure-TS discrete-event simulation (the heart of the app) |
| `scripts/testEngine.ts` | Verifies the five pedagogical conclusions hold |
| `src/components/` | Student-facing UI (tabs, challenges, results, animation) |
| `src/admin/` | Instructor dashboard |
| `src/firebase/` | Firestore access (leaderboard, reflections, settings) |
| `firestore.rules` | Security rules — paste into the Firebase console |
