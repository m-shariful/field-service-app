# Project State

## Repository

`m-shariful/field-service-app`

## Current Branch Context

The authentication implementation is on `main`.

The mobile refresh-mutex hardening fix is recorded on `main` as:

```text
9f390f1 fix(mobile): harden refresh mutex cleanup
```

The `feature/offline-local-db` branch is a separate workstream. Offline-Local-DB work was intentionally stashed before the authentication documentation work and will be restored only after the authentication history cleanup is complete.

## Current Architecture

The project is a production-oriented field-service application with:

- Expo / React Native mobile application
- Express / TypeScript backend
- MongoDB through Mongoose
- REST API
- Zustand client state
- local persistence planned for the offline-first milestone

Current authentication uses:

- email/password registration and login
- Google ID-token authentication
- short-lived JWT access tokens
- opaque rotating refresh tokens
- refresh-session records stored in MongoDB
- authenticated job ownership derived from the JWT user identity

## Authentication Status

Completed:

- [x] Email/password registration
- [x] Email/password login
- [x] Google authentication
- [x] JWT access tokens
- [x] Opaque refresh tokens
- [x] Refresh-token rotation
- [x] Refresh-session families
- [x] Refresh-token reuse detection
- [x] Idle timeout
- [x] Absolute timeout
- [x] Logout revocation
- [x] Authenticated `/api/auth/me`
- [x] Mobile auth state management
- [x] Mobile automatic refresh after `401`
- [x] Single-flight refresh mutex
- [x] Refresh mutex cleanup hardening
- [x] Authentication OpenAPI documentation

## Security Notes

Current implementation stores the refresh token in the mobile client's credential storage and sends it in the request body to the refresh endpoint.

On native mobile:

- `expo-secure-store` is used.

On web:

- `localStorage` is used as the current implementation.
- This is not equivalent to native secure storage.
- A future browser production architecture should consider an HttpOnly, Secure, SameSite cookie-based refresh mechanism.

Refresh tokens are opaque random secrets and only their SHA-256 hashes are persisted in the backend.

## Verification

The last reported local verification for authentication was:

- API typecheck: passed
- API tests: 31/31 passed
- API build: passed
- Mobile TypeScript check: passed
- Mobile lint: passed

## Known Follow-Up

The refresh-session schema contains a `cleanupAt` TTL index, but the current auth service does not yet populate `cleanupAt` when sessions are revoked. Automatic cleanup therefore remains an implementation follow-up.

The offline-first local database and synchronization work is the next major feature area.
