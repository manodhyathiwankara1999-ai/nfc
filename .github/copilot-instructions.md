# Engineering instructions

## Stack lock

- Use pnpm workspaces and Turborepo; do not substitute package managers or build orchestration.
- `apps/web` is Next.js 14 + TypeScript + Tailwind.
- `apps/api` is NestJS 10 + TypeScript.
- `packages/shared` owns transport-safe shared types and runtime schemas.
- Use Prisma with PostgreSQL. Supabase Auth handles identity and email flows; Supabase PostgreSQL remains the database host. Do not use Supabase Storage or service-role keys in the web app.
- Authentication uses Supabase Auth sessions in the web app. The API validates bearer tokens against Supabase and enforces roles from its own database.
- Redis-backed caching and queues are deferred by explicit project decision. Keep public rate limits process-local; Cloudflare R2 remains an infrastructure integration. Do not add Resend for auth email.

## Folder and dependency rules

- Keep `apps/web/src/app/` routes and layouts thin: parse route context and delegate to `features/`.
- Put feature behavior and feature-owned UI in `apps/web/src/features/`.
- Put reusable presentation primitives in `apps/web/src/components/ui/`.
- Put all web-to-server requests in `apps/web/src/lib/api/`; web code must never connect directly to PostgreSQL/Prisma or contain database credentials.
- Keep domain modules and all database access in `apps/api/`. Use `packages/shared/` only for browser-safe contracts, Zod schemas, and constants; never export server secrets or Prisma implementation details.
- Keep infrastructure integrations behind adapters/modules so domain logic does not depend directly on vendor SDKs. Supabase SSR/Auth clients belong in web auth helpers; API authorization stays server-side.

## TypeScript and validation

- Keep TypeScript strict; avoid `any`, unsafe casts, and non-null assertions when a proper type or guard is possible.
- Validate every untrusted boundary with Zod: API body/params/query, web form input, environment configuration, shared messages, uploaded-file metadata, and third-party webhook payloads.
- Use shared schemas where they are genuinely the same contract; keep authorization and domain invariants enforced in the API as well.
- Return errors consistently as `{ statusCode, code, message, requestId }`. Do not swallow errors or return success-shaped fallbacks.

## Security

- Never trust client-supplied user, owner, tenant, role, or resource IDs. Derive identity from a validated server-side credential and verify resource ownership and RBAC for every operation.
- Enforce authorization in API guards/services, not only in UI visibility or route middleware.
- Never expose secrets, database credentials, Supabase service-role keys, or private provider credentials in the client bundle, logs, or committed files. The Supabase anon key is public configuration; never use it as authorization.
- Validate Supabase sessions server-side and derive identity from the validated token; never trust client metadata for roles or ownership.
- Collect no raw IP addresses. If a justified feature needs IP correlation, retain keyed hashes only, with documented access and retention.
- Default R2 objects to private unless public delivery is explicitly required; validate ownership, detected content type, and size on the server.
- Rate-limit sensitive auth and public endpoints; avoid leaking account existence or private data in error details.

## Completion checks

- Run lint, typecheck, and build before finishing. Report any pre-existing or environment-blocked failures clearly; do not claim success when a check fails.
