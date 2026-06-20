# Molkky Tournament Director

Next.js app for running a Molkky tournament on four simultaneous fields.

## What it does

- Registers 20+ players from a pasted list.
- Generates 3 or 4 qualification rounds.
- Splits large rounds into waves when more than 16 players are competing.
- Creates games with 4 players, or 3 when the player count does not divide cleanly.
- Rotates opponents with a deterministic scheduler that avoids repeated pairings where possible.
- Ranks qualification standings by wins, points, average score, then name.
- Creates four semifinals from the top 16 players.
- Creates a final from semifinal winners.
- Saves locally, exports JSON, and syncs to Firestore when Firebase env vars are configured.
- Uses Tailwind CSS 4 through `@tailwindcss/postcss`.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Firebase setup

Create a Firebase web app and add these values to `.env.local`:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

Firestore stores tournament documents in:

```text
tournaments/{tournamentId}
```

For a private event, tighten `firestore.rules` before sharing the app publicly.

## Vercel

1. Push this project to a Git repository.
2. Import the repository in Vercel.
3. Add the same Firebase environment variables in Vercel Project Settings.
4. Deploy.

Vercel detects Next.js automatically, so no custom build command is required beyond the default `npm run build`.
