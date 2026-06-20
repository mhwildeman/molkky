# Auth0 identity with Firebase

This guide describes two supported ways to use Auth0 identities with Firebase. Read the pricing section before choosing an integration.

## Recommended player experience

1. Ask for the player's email address and nickname in a mobile-first form.
2. Save the nickname only as temporary browser state until the email address has been verified. A nickname is profile data, never proof of identity or authorization.
3. Redirect to Auth0 Universal Login with `screen_hint=signup` and `login_hint=<email>`.
4. Use Auth0 Passwordless Email so Auth0 sends a one-time password (OTP). Do not use one shared or reusable "generic invite code". Codes must be unique, short-lived, single-use, rate-limited, and stored only as hashes if the application generates them itself.
5. After authentication, require the `email` and `email_verified` claims. Let the authenticated player create their own non-privileged participant profile directly in Firestore; Rules must restrict the document ID to their Firebase UID, validate the nickname, and prevent client-controlled roles or memberships.
6. Store the authenticated Firebase UID on the participant document. Firestore authorization must use that UID, not email address or nickname.

Auth0's built-in email service is for testing. Configure a production SMTP provider before launch.

## Selected architecture: direct Auth0 OIDC in Firebase

This is the selected implementation. Its 50-OIDC-MAU Firebase free allowance is accepted for this application.

### 1. Configure Auth0

1. Create an Auth0 tenant.
2. Under **Applications → Applications**, create a **Regular Web Application**. Firebase is the confidential OIDC client and must keep the client secret.
3. Use the Authorization Code flow. Keep RS256 token signing enabled.
4. Under **Authentication → Passwordless**, enable Email and configure OTP delivery.
5. Configure a production SMTP provider and email template.
6. Enable the Passwordless Email connection for the application.
7. Add the exact redirect URI displayed by Firebase's OIDC-provider setup to Auth0's **Allowed Callback URLs**. It normally resembles:

   ```text
   https://<firebase-auth-domain>/__/auth/handler
   ```

   Use exact production and staging URLs. Do not use wildcard callback URLs.
8. Record the Auth0 client ID, client secret, and issuer. Copy the issuer exactly from the tenant's `/.well-known/openid-configuration` response.

### 2. Configure Firebase Authentication

1. Upgrade Firebase Authentication to **Firebase Authentication with Identity Platform**. This is required for generic OIDC.
2. Under **Authentication → Sign-in method**, add an **OpenID Connect** provider.
3. Select the Authorization Code flow; do not use the implicit flow.
4. Enter the Auth0 issuer, client ID, and client secret.
5. Give the provider a stable ID such as `oidc.auth0` and add it to `.env.local` and Vercel:

   ```text
   NEXT_PUBLIC_FIREBASE_AUTH_OIDC_PROVIDER_ID=oidc.auth0
   ```

6. Add the production Vercel domain and stable staging domain to Firebase Authentication's authorized domains. Avoid enabling authentication on arbitrary Vercel preview domains.

The Auth0 client secret belongs only in Auth0/Firebase configuration. Never put it in a `NEXT_PUBLIC_*` variable or client code.

### 3. Start authentication in the browser

Load Firebase Auth only when the player chooses to sign in:

```ts
export async function startPlayerSignup(email: string, nickname: string) {
  sessionStorage.setItem("pending-player-nickname", nickname.trim());

  const { getAuth, OAuthProvider, signInWithRedirect } = await import("firebase/auth");
  const providerId = process.env.NEXT_PUBLIC_FIREBASE_AUTH_OIDC_PROVIDER_ID;
  if (!providerId) throw new Error("Missing Firebase OIDC provider ID");

  const provider = new OAuthProvider(providerId);
  provider.addScope("email");
  provider.addScope("profile");
  provider.setCustomParameters({
    login_hint: email.trim().toLowerCase(),
    screen_hint: "signup",
  });

  await signInWithRedirect(getAuth(), provider);
}
```

On return, call `getRedirectResult()`/observe auth state and require a verified email. The player can then create their own participant profile directly in Firestore. Use a Firestore transaction and a deterministic normalized-nickname reservation document if nicknames must be unique; Rules must validate both writes and must never accept a client-supplied role or membership.

### 4. Use identity in Firestore

Firebase/Identity Platform supports just-in-time provisioning for OIDC: the first successful Auth0 sign-in creates a Firebase user linked to that OIDC credential. Subsequent sign-ins resolve to the same Firebase user as long as the Auth0 issuer and subject remain stable.

Standard identity data is available to Firebase, and upstream OIDC claims are available to an Identity Platform blocking function as `context.credential.claims`. Arbitrary Auth0 authorization claims are **not automatically copied** into the Firebase ID token that Firestore Rules evaluates. If a global Auth0 role is required in Rules:

1. Add a namespaced, allowlisted role claim to the Auth0 ID token.
2. Configure an Identity Platform `beforeSignIn` blocking function.
3. Confirm `context.credential.providerId === "oidc.auth0"` and validate the expected claim type and allowed values.
4. Return the role as a Firebase `sessionClaims` value for that sign-in, or as a minimal persistent `customClaims` value when persistence is truly required.
5. Authorize with `request.auth.token.<claim>` in Firestore Rules.

Blocking functions run on Cloud Run functions and must remain within its no-cost quota. They are on the authentication path, must fail closed, and must respond within Identity Platform's timeout. Do not use client-provided profile data to set authorization claims.

Tournament membership changes frequently and should not be encoded in token claims. Store membership under the tournament and let Rules check the participant document by `request.auth.uid`; this takes effect immediately and avoids waiting for ID-token refresh.

Split games into their own documents before enabling client score writes:

```text
tournaments/{tournamentId}
tournaments/{tournamentId}/participants/{firebaseUid}
tournaments/{tournamentId}/games/{gameId}
```

Participant documents should contain the Firebase UID, normalized nickname, role, and status. Game documents should contain immutable `playerIds` and a separate `scores` map. Firestore rules must:

- require `request.auth != null` for reads;
- allow users with the mapped `admin` claim to create and administer tournaments, participants, and game assignments from the browser;
- allow a player to create or update only their own participant profile document, with an allowlist of non-privileged fields;
- reject any player attempt to assign or change roles, tournament membership, game membership, or another user's profile;
- permit score updates only when `request.auth.uid` is in the game's `playerIds`;
- allow only the `scores` field to change;
- ensure score keys belong to assigned players and score values satisfy game limits; and
- keep round, field, stage, and player assignments immutable.

Do not deploy client write rules against the current single-document tournament model; it cannot safely isolate score updates from administrative changes.

With direct OIDC and the claim-mapping hook, no Vercel API or Firebase Admin SDK is required for these application operations. The signed Firebase ID token and Firestore Rules are the authorization boundary. Auth0 administration and the Identity Platform `beforeSignIn` hook remain trusted infrastructure configuration.

## Alternative only: Auth0 plus Firebase custom tokens

Use this option if Firebase's generic-OIDC pricing is undesirable. It adds one trusted Vercel exchange during sign-in:

1. Authenticate the player with Auth0 Universal Login.
2. Send the Auth0 ID token to a Vercel route.
3. Verify its issuer, audience, signature, expiry, nonce where applicable, and `email_verified` claim against Auth0's JWKS.
4. Derive a stable Firebase UID from the Auth0 `sub`; do not use the nickname.
5. Dynamically import Firebase Admin inside this route and mint a Firebase custom token with minimal claims.
6. Return the short-lived custom token to the browser and call `signInWithCustomToken()`.

This is not Firebase's generic OIDC provider feature. Firebase bills it as custom authentication, whose no-cost allowance is substantially larger. The tradeoff is maintaining and securing the token-exchange endpoint. Never accept an unverified Auth0 token or trust roles supplied by the browser.

## Pricing checked on 2026-06-19

- Auth0's B2C Free plan advertises up to **25,000 monthly active users** and includes passwordless authentication. Limits and production-email costs still apply.
- Firebase Authentication with Identity Platform on Blaze includes only **50 OIDC/SAML MAUs per month** at no cost; usage above that is currently **US$0.015 per MAU**.
- On Spark, upgraded Identity Platform projects are limited to **2 OIDC/SAML daily active users**, which is useful only for development.
- Firebase custom authentication is a tier-1 provider: Identity Platform on Blaze currently includes up to **50,000 MAUs** at no cost. This makes Option B worth considering despite the extra server exchange.
- Firestore usage and the production SMTP/email provider have separate quotas and pricing.
- The project must remain inside every provider's no-cost allowance. Configure budget and usage alerts, but do not treat a budget alert as a hard spending cap. At 50 OIDC MAUs, the next distinct monthly user can create a Firebase charge on Blaze, so monitor this limit explicitly.

Check pricing again before implementation or launch:

- Firebase OIDC setup: https://firebase.google.com/docs/auth/web/openid-connect
- Firebase Authentication and limits: https://firebase.google.com/docs/auth
- Firebase pricing: https://firebase.google.com/pricing
- Google Identity Platform pricing: https://cloud.google.com/identity-platform/pricing
- Auth0 pricing: https://auth0.com/pricing
- Auth0 passwordless email: https://auth0.com/docs/authenticate/passwordless/authentication-methods/email-otp
- Auth0 application settings: https://auth0.com/docs/get-started/applications/application-settings
- Identity Platform blocking functions and OIDC claim mapping: https://cloud.google.com/identity-platform/docs/blocking-functions
- Firebase custom claims: https://firebase.google.com/docs/auth/admin/custom-claims
