# nfc-ecard-v1

Digital business card platform with Supabase authentication, profile editing,
custom themes, avatar uploads, public profiles, and browser-generated vCards.

## Monorepo

- `apps/web` — Next.js 15 App Router frontend and Cloudflare OpenNext Worker.
- `apps/api` — NestJS API, Prisma/PostgreSQL data access, and Cloudflare Container gateway.
- `packages/shared` — shared enums, Zod schemas, and transport-safe types.
- `supabase/migrations` — current database schema migrations.
- `docs/BLUEPRINT.md` — architecture notes.

## Prerequisites

- Node.js 20 or newer
- pnpm 9.15.4 (`npm install --global pnpm@9.15.4` if it is not installed)
- A Supabase project
- Docker Desktop for building and deploying the API Container to Cloudflare

## Setup

1. Install the workspace:
   ```bash
   pnpm install
   ```
2. Create `apps/web/.env.local` from `apps/web/.env.example`, then fill in the
   Supabase project URL and anon key. Set `NEXT_PUBLIC_APP_URL` to the app
   origin (for local development, `http://localhost:3000`).
3. Run `supabase/migrations/0001_init.sql` in the Supabase SQL Editor.
4. Enable email/password and, if desired, Google under Supabase Authentication
   providers. Add `<app-origin>/auth/callback` to the allowed redirect URLs.
5. Start the web app:
   ```bash
   pnpm dev
   ```
6. Open <http://localhost:3000>. Signup, edit your profile and theme color at
   `/dashboard/profile`, then open the public `/u/<slug>` profile.

## Workspace commands

Run these from the repository root:

| Command                             | Purpose                                                        |
| ----------------------------------- | -------------------------------------------------------------- |
| `pnpm dev`                          | Start all workspace development tasks.                         |
| `pnpm build`                        | Build shared packages, then build workspace applications.      |
| `pnpm lint`                         | Run configured workspace linters.                              |
| `pnpm typecheck`                    | Run strict TypeScript checks across workspaces.                |
| `pnpm test`                         | Run workspace tests.                                           |
| `pnpm run build:cloudflare:web`     | Build the frontend for Cloudflare Workers with OpenNext.       |
| `pnpm run typecheck:cloudflare:api` | Generate Worker types and typecheck the API Container gateway. |

## Deployment

### Frontend: Cloudflare Workers with OpenNext

```bash
pnpm run build:cloudflare:web
pnpm run preview:cloudflare:web
pnpm run deploy:cloudflare:web
```

The frontend is a server-rendered Next.js app, not a static Pages export. It is
packaged as a Worker by `@opennextjs/cloudflare`; the Worker configuration is
in `apps/web/wrangler.jsonc`. The standard `pnpm build` and
`pnpm --filter @nfc/web build` commands do not produce the OpenNext Worker
bundle. This keeps the existing app on Next.js rather than migrating its
toolchain to vinext. OpenNext warns that Windows support is limited; use WSL or
a Linux CI runner for Cloudflare packaging.

Set the following frontend variables in the Cloudflare Workers build
environment. `API_INTERNAL_URL` is consumed at Next.js build time by the API
rewrite and must also be configured as a Worker runtime variable for server
requests. Deploy the API first and set both to the API Worker URL.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`
- `API_INTERNAL_URL`
- `NEXT_PUBLIC_R2_PUBLIC_BASE_URL` (only when public R2 image delivery is used)
- `NEXT_PUBLIC_ORDER_CARD_URL` (optional)

At Worker runtime, configure `API_INTERNAL_URL` as a variable and
`REVALIDATION_SECRET` as a secret; the revalidation secret must match the API
secret. `NEXT_PUBLIC_*` values are public and are embedded in the frontend
build.

For GitHub-connected Workers Builds, use the repository root as the project
root, install with `pnpm install --frozen-lockfile`, and use
`pnpm run build:cloudflare:web` as the build command. Configure the variables
above in the build environment; use secrets for values that are not public.

### API: Cloudflare Containers

The API uses NestJS with the Express adapter and Prisma's native PostgreSQL
client. It cannot run directly in the Workers isolate. The API deployment
therefore uses the existing `apps/api/Dockerfile` in Cloudflare Containers,
routed through a Durable Object Worker in `apps/api/cloudflare/worker.ts`.
The gateway keeps one lazily started container instance so the API's existing
process-local public rate limits retain their current semantics. The container
uses the existing API process and database logic, and requires outbound
internet access for Supabase PostgreSQL and optional R2 operations. Add a
shared rate-limit store before scaling this gateway to multiple API instances.

Docker must be running, and the Cloudflare account must have Containers
enabled. Generate the gateway types and check it, then preview or deploy:

```bash
pnpm run typecheck:cloudflare:api
pnpm run preview:cloudflare:api
pnpm run deploy:cloudflare:api
```

Configure these API Worker variables in Cloudflare. Use `wrangler secret put
<NAME> --config wrangler.jsonc` from `apps/api` for the required secrets; set
the other variables in the Cloudflare dashboard or Wrangler environment
configuration. Do not commit their values or put secret values in
`wrangler.jsonc`.

Required secrets:

- `DATABASE_URL` (Supabase pooler URL on port 6543 with
  `pgbouncer=true&connection_limit=1`)
- `DIRECT_URL` (Supabase direct PostgreSQL URL on port 5432)
- `REVALIDATION_SECRET` (at least 32 characters; same value as the frontend)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `IP_HASH_SALT` (independent random value of at least 32 characters)

Required non-secret variables:

- `WEB_APP_URL` (frontend origin)
- `CORS_ORIGINS` (comma-separated allowed frontend origins)

Optional API variables include `TRUSTED_PROXY_IPS`, `MAX_CARDS_PER_USER`,
`GALLERY_MAX_IMAGES`, `ANALYTICS_RAW_RETENTION_DAYS`, and `SENTRY_DSN`. For R2,
configure all of `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, and `R2_PUBLIC_BASE_URL`, or leave
them all unset.

The gateway restarts the running container when a new image is deployed.
Container environment values are captured at startup; after rotating API
secrets, restart the container from the Cloudflare dashboard so it receives
the new values.

Cloudflare Container deployment builds the Docker image during `wrangler deploy`;
Docker must also be available in a GitHub Actions runner if deploying
from CI. Configure `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as CI
secrets. Check Cloudflare's account and plan availability for Containers
before enabling automatic deployment.

### Build commands

- `pnpm run build` builds the monorepo. The API's `prebuild` generates Prisma
  Client from `apps/api/prisma/schema.prisma`, and Turbo builds workspace
  dependencies first.
- `pnpm exec turbo run build --filter=@nfc/web` builds only the frontend and
  its workspace dependencies, without building the API.
- `pnpm --filter api build` builds the API independently; its `prebuild`
  generates Prisma Client.
- `pnpm run build:cloudflare:web` builds only the frontend and its OpenNext
  Worker bundle.

## Web structure

```text
apps/web/src/
  app/                  Thin route entry points and route groups
  features/             Auth, profile, dashboard, and public-profile behavior
  components/
    layout/             Responsive application shell
    ui/                 Shared presentation primitives
  lib/
    api/                Future typed API client boundary
    auth/               Authentication utilities
    db/                 Deprecated Supabase profile data access; do not extend
    supabase/           Existing Supabase client factories
    utils/              Shared web utilities
```

Routes use route groups `(marketing)`, `(auth)`, and `(dashboard)` without
changing their public URLs. Feature components hold page behavior; route files
should remain thin. Keep UI primitives in `components/ui`, call future server
endpoints only through `lib/api`, and do not add new direct database access to
the web app.

## Current feature status

Implemented: Supabase signup/login/OAuth callback, profile CRUD and visibility,
public `/u/[slug]` profiles, a fixed profile editor with a live one-color theme
preview, R2 image uploads, CSV/vCard downloads, cards, and analytics.
Commercial accounts and billing remain roadmap items. See
[docs/AUDIT.md](docs/AUDIT.md) for the broader repository inventory.
#   n f c  
 #   n f c  
 #   n f c  
 