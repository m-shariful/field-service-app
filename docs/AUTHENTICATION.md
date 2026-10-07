# Authentication Architecture

## 1. Purpose

This document describes the authentication system currently implemented in the Field Service application.

The design supports:

- email/password authentication
- Google authentication
- short-lived access tokens
- rotating opaque refresh tokens
- refresh-session tracking
- refresh-token reuse detection
- idle timeout
- absolute timeout
- logout
- mobile session restoration

The goal is not only to authenticate a user, but to maintain a recoverable session while limiting the lifetime and reuse of long-lived credentials.

---

## 2. High-Level Flow

```text
                 +----------------------+
                 |   Mobile App        |
                 | Expo / React Native  |
                 +----------+-----------+
                            |
                 login / google / refresh
                            |
                            v
                 +----------------------+
                 |   Express API        |
                 | Auth Controllers     |
                 +----------+-----------+
                            |
                            v
                 +----------------------+
                 |   Auth Service       |
                 | session + validation |
                 +-------+---------+----+
                         |         |
                         v         v
                    UserModel  AuthIdentityModel
                         |
                         v
                 RefreshSessionModel
                         |
                         v
                      MongoDB
```

The mobile API client owns automatic access-token refresh.

The Zustand auth store owns application-level authenticated-user state.

The backend owns the authoritative session lifecycle.

---

## 3. Authentication Methods

### 3.1 Email / Password

Registration:

```text
name + email + password
        -> validate request
        -> check existing email
        -> bcrypt hash
        -> create User
        -> create access token
        -> create refresh session
        -> return user + accessToken + refreshToken
```

Passwords are never stored directly.

The current implementation uses `bcryptjs` with a cost of `12`.

Password validation currently requires at least 8 characters.

### 3.2 Login

```text
email + password
        -> find user
        -> compare password hash
        -> create session tokens
```

Invalid credentials return an authentication failure rather than exposing whether the email or password was specifically incorrect.

### 3.3 Google Authentication

The mobile application obtains a Google ID token and sends it to:

```text
POST /api/auth/google
```

The backend verifies the ID token using Google's verification library.

The backend checks:

- token audience
- token issuer
- Google subject (`sub`)
- email presence
- email verification status

Google identity records are stored separately from the application user.

```text
Google providerUserId
        |
AuthIdentity
        |
application User
```

The same Google identity can therefore be mapped to one application user.

If a local account already exists for the email but the Google identity has not been linked, the current system returns:

```text
ACCOUNT_LINK_REQUIRED
```

It does not silently merge accounts.

---

## 4. Access Token

The access token is a signed JWT.

Default lifetime:

```text
15 minutes
```

The token contains:

```text
userId
jti
```

The `jti` is a unique UUID generated for each access token.

This ensures that two access tokens generated within the same second still receive distinct token identifiers.

The mobile API client sends the token as:

```http
Authorization: Bearer <access-token>
```

---

## 5. Refresh Token

Refresh tokens are intentionally not JWTs.

They are opaque random secrets generated with:

```text
64 random bytes
```

The plaintext refresh token is returned to the client.

The backend stores:

```text
SHA-256(refreshToken)
```

rather than the plaintext token.

---

## 6. Refresh Session Model

A refresh session contains:

```text
id
userId
familyId
tokenHash
expiresAt
idleExpiresAt
lastUsedAt
revokedAt
revokeReason
replacedBySessionId
cleanupAt
```

### Session identity

`id` identifies one refresh-session record.

### User identity

`userId` connects the session to the application user.

### Session family

`familyId` connects every rotated token belonging to the same login session.

Example:

```text
login
  |
  +-- family-A
       |
       +-- session-1
       +-- session-2
       +-- session-3
       +-- session-4
```

### Rotation chain

```text
session-1
   | replaced by
   v
session-2
   | replaced by
   v
session-3
```

---

## 7. Session Lifetime

Two independent limits are enforced.

### Absolute lifetime

Default:

```text
30 days
```

The session family cannot live beyond the original absolute expiry.

A refresh operation cannot extend the family past this boundary.

### Idle lifetime

Default:

```text
7 days
```

A refresh session becomes invalid after the configured period of inactivity.

Idle expiry is calculated so it cannot exceed the absolute expiry.

Therefore:

```text
effective idle expiry
    <=
absolute expiry
```

---

## 8. Refresh Flow

The refresh endpoint is:

```text
POST /api/auth/refresh
```

Request:

```json
{
  "refreshToken": "opaque-token"
}
```

Flow:

```text
presented refresh token
        -> SHA-256 hash
        -> find RefreshSession by tokenHash
        -> is session revoked?
        -> absolute timeout?
        -> idle timeout?
        -> does user still exist?
        -> create replacement refresh session
        -> atomically revoke current session
        -> create new access token
        -> return new accessToken + refreshToken
```

---

## 9. Refresh Token Rotation

Refresh tokens are single-use.

Suppose:

```text
R1
```

is presented successfully.

The server creates:

```text
R2
```

and marks the old session:

```text
revokedAt = now
revokeReason = ROTATED
replacedBySessionId = R2 session
```

The client must now use `R2`.

`R1` must never be accepted again.

---

## 10. Concurrent Refresh Protection

Mobile applications can have multiple API requests fail at nearly the same time when an access token expires.

Without coordination:

```text
Request A -> 401 -> refresh
Request B -> 401 -> refresh
Request C -> 401 -> refresh
```

This is dangerous because refresh tokens are rotated.

The mobile API client therefore uses a shared promise:

```text
Request A -+
Request B -+
Request C -+--> same refreshPromise
Request D -+
Request E -+
```

Only one refresh request is executed.

All waiting API calls share its result.

The mutex cleanup is explicitly handled for both paths:

```text
success -> refreshPromise = null
failure -> refreshPromise = null
```

This prevents a rejected refresh promise from remaining stuck inside the mutex.

---

## 11. Server-Side Reuse Detection

A refresh token that was already rotated carries:

```text
revokeReason = ROTATED
```

If that old token is presented again, the system treats it as refresh-token reuse.

Flow:

```text
old rotated token presented
        -> session is already revoked
        -> reason == ROTATED
        -> REUSE_DETECTED
        -> revoke entire session family
        -> reject request
```

Family-wide revocation is important because reuse can indicate that a previously valid refresh credential has been copied or replayed.

The API returns the client-facing failure:

```text
INVALID_REFRESH_TOKEN
```

and the mobile client must require a new sign-in.

---

## 12. Atomic Rotation

The backend does not simply read a session and then blindly mark it revoked.

The rotation uses an atomic update that requires:

```text
the same session
AND
revokedAt == null
```

Only one concurrent request can win that compare-and-set operation.

If another request already changed the session, the update returns no rotated document.

The losing request then treats the situation as concurrent refresh / reuse and revokes the family.

---

## 13. Logout

Endpoint:

```text
POST /api/auth/logout
```

The client sends its current refresh token.

The server:

```text
hash token
  -> find session
  -> if active -> revoke with LOGOUT
  -> return success
```

Logout is intentionally idempotent.

If the session is already revoked or cannot be found, the mobile client still clears local credentials.

This keeps local sign-out reliable even when the network is unavailable.

---

## 14. Mobile Session Storage

### Native

The current native implementation uses:

```text
expo-secure-store
```

for both access and refresh tokens.

### Web

The current web implementation uses:

```text
localStorage
```

This is a compatibility implementation and is not security-equivalent to `expo-secure-store`.

A browser production deployment should be evaluated separately, with an HttpOnly, Secure, SameSite cookie strategy being a likely future direction for refresh credentials.

---

## 15. Mobile Auth State Responsibilities

### API client

Responsible for:

- attaching access tokens
- detecting `401`
- performing refresh
- retrying the original request once
- preventing concurrent refresh storms
- invoking the unauthorized handler when the session is unrecoverable

### Auth store

Responsible for:

- current user
- `isAuthenticated`
- initialization
- session persistence
- application-level sign-out
- unauthorized-session cleanup

The separation is intentional:

```text
API Client
    |
credential lifecycle

Auth Store
    |
application session state
```

---

## 16. Session Initialization

On application startup:

```text
read persisted access token
read persisted refresh token
        -> missing either?
        -> GET /api/auth/me
        -> 401? -> API client attempts refresh
        -> restore authenticated user
```

The auth store therefore does not implement a second independent refresh system.

---

## 17. Security Properties

Current implementation provides:

- password hashing
- signed JWT access tokens
- short access-token lifetime
- opaque high-entropy refresh tokens
- server-side token hashing
- refresh-token rotation
- replay/reuse detection
- session-family revocation
- idle timeout
- absolute timeout
- server-side logout
- Google ID-token verification
- verified Google email requirement
- user lookup during authenticated requests

The system intentionally avoids putting secrets into authentication debug logs.

The debug helper redacts keys containing:

```text
token
secret
password
```

---

## 18. Known Gaps / Future Hardening

These are deliberately not described as completed features.

### Refresh-session cleanup

The schema defines:

```text
cleanupAt
```

with a MongoDB TTL index.

The current auth service does not yet populate `cleanupAt` during session revocation.

A future cleanup strategy should set an explicit retention time after revocation.

### Browser credential model

The web implementation currently uses `localStorage`.

A browser production architecture should evaluate HttpOnly cookie-based refresh sessions.

### Authentication rate limiting

Rate limiting for login, registration, Google authentication, and refresh should be added before production hardening.

### Account recovery

Password reset and account recovery are not part of the current implementation.

### Multi-device session management

The current data model supports multiple refresh-session families, but a user-facing session-management screen is not implemented yet.

---

## 19. API Contract

Current authentication endpoints:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/google
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
```

The canonical machine-readable API contract lives in:

```text
apps/api/docs/openapi.yaml
```

---

## 20. Verification

The last reported local verification for the authentication implementation was:

```text
API typecheck   ✓
API tests 31/31 ✓
API build       ✓
Mobile tsc      ✓
Mobile lint     ✓
```

Authentication documentation should be kept synchronized with implementation changes, especially changes to:

- token lifetime
- refresh rotation
- session revocation
- storage
- Google authentication
- refresh mutex behavior
