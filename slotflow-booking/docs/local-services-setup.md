# Local database and authentication setup

## PostgreSQL

- PostgreSQL 18 is installed as a Windows service and was running during setup.
- A local database named `slotflow`, owned by `postgres`, was created on `localhost:5432`.
- The ignored local `.env` file now points `DATABASE_URL` at that database. Credentials stay in `.env` and are not copied into this document.
- The Drizzle schema was generated and applied. It creates the application's 11 PostgreSQL tables and related indexes/constraints.
- The repository already contained an older MySQL migration journal in `drizzle/`. `drizzle.config.ts` now writes PostgreSQL migrations to `drizzle/pg-migrations/` so new schema changes do not consume the incompatible MySQL history.

Run `pnpm db:push` after changing `drizzle/schema.ts` to generate and apply a migration. Keep `.env` private and back up the database before applying schema changes to a database with valuable data.

## OAuth status

The callback route and login redirect code exist, but authentication is not configured for a usable identity provider. The local environment has an empty `OAUTH_SERVER_URL`; no provider issuer/portal URL, client registration, or redirect URI registration was available in the project settings.

The current implementation expects the provider protocol implemented by `server/_core/sdk.ts` (authorization-code exchange and user-info lookup) and the browser redirect configured by `VITE_OAUTH_PORTAL_URL`. Set those values only after choosing an OAuth provider and registering `https://<your-app-host>/api/oauth/callback` as an allowed callback URL. `VITE_APP_ID` must be the client identifier for that registration. Do not put client secrets in browser-exposed `VITE_` variables.

The OAuth-related server code still contains provider-specific compatibility code. Replacing it with a standard OIDC provider requires the selected issuer's discovery URL and client credentials; those cannot be inferred safely from an empty server URL.

## Removed development instrumentation

The browser debug collector and its Vite middleware, host allowlist entries, client debug asset, generated logs, unused branded login dialog, and runtime plugin dependency were removed. This stops development sessions from recording browser console, network, or interaction events into local log files.

Other server integrations in the application may still use provider-specific APIs. Review and replace those individually when selecting their replacements; removing their names without replacing behavior would break those features.
