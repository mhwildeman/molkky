# Project instructions

## Product and platform

- Build and deploy this application for Vercel.
- Run every service within its no-cost/free tier. A billing account may be attached where a provider requires pay-as-you-go activation, but the design must stay within no-cost quotas and must not introduce a paid baseline. The Firebase/Identity Platform allowance of 50 OIDC MAUs per month is acceptable. Recheck quotas and pricing before enabling a service, add usage/budget alerts, and obtain explicit approval before making a change that can create charges.
- Treat mobile-first design as a critical product requirement. Design and implement the smallest viewport first, then progressively enhance layouts at Tailwind breakpoints. Every tournament task, including score entry, must remain fast and comfortable on a phone without horizontal scrolling.
- Use Tailwind CSS for styling and keep it on the latest stable release that is compatible with the application.
- Prefer the latest stable, mutually compatible versions of all libraries and tooling. Check current releases before adding or upgrading a dependency.
- Keep the interface clean, compact, responsive, and useful during an active tournament. Decorative visuals must communicate something; avoid ornamental complexity.

## Performance and loading

- Load libraries only where and when they are needed. Prefer focused imports, dynamic imports, and lazy loading for optional or interaction-driven features.
- Keep Vercel server bundles small to reduce cold-start time. Do not import heavy SDKs or unrelated modules into shared layouts, middleware, route handlers, or server actions.
- Keep server-only and client-only dependency boundaries explicit. Never allow Firebase Admin or other privileged server libraries into the client bundle.
- Use Firebase's modular client SDK and import only the Firebase services the current feature uses.
- Before adding a dependency, consider whether the platform, browser, or a small local utility already provides the required behavior.

## Firebase architecture

- Use Auth0 as the player identity provider through Firebase/Identity Platform's direct generic OIDC integration. The 50-MAU no-cost allowance is accepted; do not add a custom-token bridge unless requirements change. Follow `docs/auth0-firebase-identity.md` and recheck both vendors' current pricing before implementation.
- Direct Auth0 OIDC sign-in should use Firebase/Identity Platform's just-in-time user provisioning. A player's first successful OIDC sign-in creates the linked Firebase user.
- Do not assume arbitrary Auth0 claims automatically become Firebase claims. If an Auth0 role must be available in Firestore Rules, map a small allowlist of trusted upstream claims to Firebase session/custom claims in a trusted Identity Platform `beforeSignIn` hook, then authorize against the Firebase ID token. Never copy all upstream claims wholesale.
- Keep tournament-specific membership and game assignments in Firestore participant/game documents keyed by Firebase UID. Prefer document-based membership checks for per-tournament access; reserve token claims for small, global roles because token claims are size-limited and become stale until token refresh.
- Treat email verification as identity proof. Treat nicknames as untrusted display data and Firebase UIDs as authorization identities.
- Player email codes must be unique, short-lived, single-use OTPs. Never implement a shared reusable invite code. Use a production SMTP provider; Auth0's built-in sender is for testing only.
- Run Firebase reads and writes directly in the browser with the Firebase client SDK, including administrative tournament actions. Firestore Rules must authorize admin writes using the allowlisted Auth0 role mapped into the signed Firebase ID token by `beforeSignIn`; do not proxy these actions through Next.js server actions, route handlers, or Vercel Functions.
- Use Firestore realtime listeners for shared tournament and score state so simultaneous users see changes immediately.
- Prefer the direct OIDC architecture so the application does not need Firebase Admin or a Vercel API for normal or administrative Firebase operations. The Identity Platform `beforeSignIn` hook remains the trusted boundary that maps Auth0 claims; it is infrastructure, not browser code.
- Enforce authorization in Firestore Security Rules, not only in the interface:
  - Users with the mapped global admin claim may create and administer tournaments, participants, and games from the client.
  - Authenticated users may create and update only their own non-privileged participant profile fields; they must never be able to assign themselves roles or tournament/game membership.
  - Any player who is active in a game may enter and update scores for that game.
  - Players who are not active in a game have read-only access to it.
- Design writes to remain safe under concurrent scorekeepers. Prefer focused, atomic updates or transactions over replacing an entire tournament document.
