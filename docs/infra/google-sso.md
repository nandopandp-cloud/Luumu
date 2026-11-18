# Login com Google (SSO)

The login page shows **Entrar com Google** next to the e-mail/password form. Only Google
Workspace accounts from `@jovensgenios.com` get in. E-mail/password login still works for everyone.

Code: `src/lib/auth/google.ts` (pure rules, tested in `tests/auth/google.test.ts`),
`src/lib/auth/google-sso.ts` (server), routes in `src/app/api/auth/google/`.

## Who gets in

| Case | Result |
|---|---|
| `@jovensgenios.com` with an existing Luumu account (same e-mail) | Signs in to that account; role and projects unchanged |
| `@jovensgenios.com` without an account | Account created as **Leitor** (viewer) in the Jovens Gênios workspace, seeing only GenieX, Exploradores and Educadores |
| Any other domain, or a personal Google account using a `@jovensgenios.com` address | Refused (`google_domain`) |

The domain is checked on the server, on two claims signed by Google: `hd` (Workspace domain) and
`email` (with `email_verified`). The `hd` parameter in the authorization URL only filters the
account picker.

Projects for new accounts: the projects linked to each platform in the Report Quinzenal
settings; for a platform with no link, the project whose name contains the platform name. If none
is found, the account is **not** created (an empty project scope would mean "all projects").
User, membership and project scope are written in one `db.batch()`.

Workspace for new accounts: `GOOGLE_SSO_WORKSPACE_ID`, or, when unset, the only workspace with
Report Quinzenal settings. If neither resolves, new accounts get `google_no_access`.

## Setup

1. Google Cloud Console → APIs & Services → **OAuth consent screen**: user type **Internal**
   (restricts sign-in to the `jovensgenios.com` Workspace on Google's side too).
2. **Credentials → Create credentials → OAuth client ID**, type *Web application*.
   - Authorized redirect URIs: `https://<production domain>/api/auth/google/callback` and, for
     local dev, `http://localhost:3000/api/auth/google/callback`. Preview deployments need their
     own URI, otherwise Google answers `redirect_uri_mismatch`.
3. Vercel env vars (Production, and Preview if wanted): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   optionally `GOOGLE_SSO_WORKSPACE_ID`. Redeploy.

No migration is needed.

## Flow

`/api/auth/google` creates `state`, `nonce` and a PKCE `code_verifier`, stores them in an httpOnly
cookie (10 min, single use, path `/api/auth/google`) and redirects to Google.
`/api/auth/google/callback` checks `state`, exchanges the code (with the verifier), verifies the
`id_token` against Google's JWKS (issuer, audience = client id, expiry), then checks nonce, e-mail
and domain. Errors redirect to `/login?error=<code>`; messages live in `GOOGLE_ERROR_MESSAGE`.
