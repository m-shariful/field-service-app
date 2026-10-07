# Architecture Decisions

## ADR-001: React Native + Expo

### Decision

Use React Native with Expo for the mobile application.

### Reason

- Cross-platform development
- Faster iteration
- Access to native device capabilities
- Strong TypeScript support
- Suitable tooling for mobile builds and deployment

### Status

Accepted

---

## ADR-002: REST API

### Decision

Use REST APIs for communication between the mobile application and backend.

### Reason

- Clear resource-oriented architecture
- Easy debugging
- Familiar production pattern
- Suitable for mobile clients

### Status

Accepted

---

## ADR-003: MongoDB + Mongoose

### Decision

Use MongoDB with Mongoose for backend persistence.

### Reason

- Existing project implementation is MongoDB-based.
- Mongoose provides schema modeling and validation boundaries.
- The application already models users, authentication identities, refresh sessions, and jobs through Mongoose.

### Status

Accepted

---

## ADR-004: Offline-First Mobile Architecture

### Decision

The mobile application will use a local-first/offline-first approach.

### Reason

Field professionals may operate in environments with unreliable or unavailable network connectivity.

### Consequences

The system must support:

- local persistence
- synchronization
- retry handling
- conflict detection
- conflict resolution
- idempotency

### Status

Accepted

---

## ADR-005: Short-Lived JWT Access Tokens

### Decision

Use short-lived signed JWT access tokens for authenticated API requests.

### Reason

Access tokens are presented frequently and should have a limited blast radius if compromised.

The current default lifetime is 15 minutes.

### Consequences

The mobile client needs a refresh-token mechanism.

### Status

Accepted

---

## ADR-006: Opaque Rotating Refresh Tokens

### Decision

Use opaque random refresh tokens rather than JWT refresh tokens.

Store only a SHA-256 hash in MongoDB and rotate the refresh token after every successful refresh.

### Reason

- Reduces the value of a database leak.
- Allows server-side session revocation.
- Enables single-use refresh credentials.
- Enables refresh-token reuse detection.

### Consequences

The backend must maintain refresh-session state.

The mobile client must persist the latest refresh token after rotation.

### Status

Accepted

---

## ADR-007: Refresh Token Families

### Decision

Every refresh-session chain belongs to a `familyId`.

### Reason

A replayed rotated token may indicate credential theft or concurrent misuse.

Family-level revocation allows the backend to invalidate the entire chain.

### Status

Accepted

---

## ADR-008: Single-Flight Mobile Refresh

### Decision

The mobile API client uses one shared refresh promise so concurrent `401` responses trigger one refresh operation.

### Reason

Refresh tokens are single-use and rotate on success.

Without coordination, parallel refresh requests can race and invalidate each other.

### Status

Accepted

---

## ADR-009: Google Identity as a Separate Model

### Decision

Store Google provider identity separately from the application user.

### Reason

An application user and an external identity are different concepts.

This separation leaves room for additional providers and explicit account-linking flows later.

### Status

Accepted
