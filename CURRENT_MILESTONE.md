# Current Milestone

## Milestone

Authentication hardening and documentation completion

## Objective

Move the completed authentication work into a clearly documented baseline on `main`, then return to the offline-first feature branch without carrying authentication-only commits into that branch's history.

## Completed

- [x] Email/password registration
- [x] Email/password login
- [x] Google ID-token authentication
- [x] JWT access tokens
- [x] Rotating opaque refresh tokens
- [x] Refresh-token reuse detection
- [x] Idle and absolute refresh-session timeouts
- [x] Logout revocation
- [x] Authenticated user endpoint
- [x] Mobile token persistence
- [x] Automatic token refresh after `401`
- [x] Single-flight refresh protection
- [x] Refresh mutex cleanup hardening
- [x] OpenAPI authentication contract
- [x] Authentication architecture documentation

## In Progress

- [ ] Clean authentication-only commits from `feature/offline-local-db`
- [ ] Restore the stashed Offline-Local-DB working tree
- [ ] Verify Offline-Local-DB implementation against the documented architecture

## Next

1. Confirm `main` contains the authentication fix and documentation.
2. Remove the authentication-only commit history from `feature/offline-local-db`.
3. Restore the Offline-Local-DB stash.
4. Inspect the actual SQLite implementation before making further changes.
5. Complete the first offline local-persistence slice with tests.
