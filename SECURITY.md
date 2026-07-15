# Security Policy

## Reporting a vulnerability

If you believe you've found a security issue in Beauty OS, please email
**naniclecinematics@gmail.com** with:

- a description of the issue and its impact,
- steps to reproduce (proof-of-concept if possible), and
- any relevant logs or screenshots.

We aim to acknowledge reports within **3 business days** and to keep you updated
as we investigate. Please give us a reasonable window to remediate before any
public disclosure, and avoid accessing or modifying other tenants' data while
testing.

Machine-readable contact: [`/.well-known/security.txt`](public/.well-known/security.txt).

## How Beauty OS protects data

- **Tenant isolation** is enforced at the database with PostgreSQL Row-Level
  Security — the app connects as a restricted role and every tenant-scoped
  table denies cross-tenant access by default. (See `docs/RLS.md`.)
- **Passwords** are hashed with scrypt (per-user salt); they are never stored or
  logged in plaintext.
- **Two-factor authentication** (TOTP) is available; recovery codes are hashed
  and single-use, and the TOTP secret is encrypted at rest (AES-256-GCM).
- **Transport** is HTTPS only, with HSTS. Session cookies are `HttpOnly`,
  `Secure`, `SameSite=Lax`.
- **Abuse controls**: DB-backed rate limiting on signup and verification email.
- **Observability**: application errors are captured in Sentry.
- **Change safety**: CI runs lint, type-check, and tests on every change.

## Supported versions

Beauty OS is a continuously deployed SaaS; the running production version is the
only supported version.
