# Changelog

## Authentication

### Added

- Email/password registration and login.
- Google ID-token authentication.
- JWT access-token authentication.
- Opaque rotating refresh tokens.
- Refresh-session families.
- Refresh-token reuse detection with family-wide revocation.
- Idle timeout and absolute timeout handling.
- Logout session revocation.
- Authenticated `/api/auth/me` endpoint.
- Mobile auth-state persistence and restoration.
- Mobile automatic access-token refresh after `401`.
- Single-flight refresh protection so concurrent requests share one refresh operation.
- OpenAPI documentation for authentication endpoints.
- Detailed authentication architecture documentation.

### Hardened

- Access tokens receive a unique `jti`.
- Refresh-token rotation uses an atomic compare-and-set update so concurrent refreshes cannot both succeed.
- Reuse of a rotated refresh token revokes the refresh-token family.
- Refresh mutex cleanup clears the shared promise on both success and failure.

## Documentation

- Added project state and current milestone tracking at repository root.
- Added authentication documentation under `docs/AUTHENTICATION.md`.
- Updated architecture, decisions, learning, and project documentation to reflect the implemented authentication baseline and current MongoDB-based backend.
