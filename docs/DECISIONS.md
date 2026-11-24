# Architecture Decision Records

This document captures important architectural decisions and their reasoning.

## ADR-001: React Native and Expo

**Decision:** Use React Native with Expo for the mobile application.

**Reasoning:**

- Cross-platform mobile development
- TypeScript support
- Access to native capabilities
- Faster development iteration
- Expo ecosystem integration

**Status:** Accepted

---

## ADR-002: REST API

**Decision:** Use REST APIs for mobile/backend communication.

**Reasoning:**

- Resource-oriented API design
- Clear HTTP semantics
- Easy debugging
- Suitable for mobile clients
- Straightforward API documentation

**Status:** Accepted

---

## ADR-003: MongoDB and Mongoose

**Decision:** Use MongoDB with Mongoose for backend persistence.

**Reasoning:**

- Flexible document modeling
- Schema validation
- Existing project implementation
- Suitable support for job, user, session, and notification records

**Trade-off:** Data consistency requirements must be handled carefully through schema constraints, atomic updates, and transactions where appropriate.

**Status:** Accepted

---

## ADR-004: Offline-First Mobile Architecture

**Decision:** Use local-first persistence for field workflows.

**Reasoning:**

Field professionals may work in environments with unreliable connectivity.

The application should preserve user operations locally and synchronize them when possible.

**Consequences:**

- Local database
- Durable mutation queue
- Retry handling
- Idempotency
- Version-aware synchronization
- Conflict resolution

**Status:** Accepted

---

## ADR-005: SQLite for Mobile Persistence

**Decision:** Use Expo SQLite for durable local data.

**Reasoning:**

- Persistent on-device storage
- Transaction support
- Suitable for structured relational data
- Offline access
- Synchronization metadata support

**Status:** Accepted

---

## ADR-006: Short-Lived JWT Access Tokens

**Decision:** Use short-lived signed JWT access tokens.

**Current default lifetime:** 15 minutes.

**Reasoning:**

- Limits the exposure window of compromised access credentials.
- Allows stateless access-token verification.
- Keeps long-lived session management separate.

**Status:** Accepted

---

## ADR-007: Opaque Rotating Refresh Tokens

**Decision:** Use cryptographically random opaque refresh tokens instead of JWT refresh tokens.

Store only the SHA-256 token hash in MongoDB.

**Reasoning:**

- Server-side revocation
- Single-use rotation
- Reuse detection
- Reduced impact of database exposure

**Status:** Accepted

---

## ADR-008: Refresh Token Families

**Decision:** Associate rotated refresh sessions with a shared family identifier.

**Reasoning:**

If a previously rotated token is reused, the server can identify and revoke the related session family.

**Status:** Accepted

---

## ADR-009: Single-Flight Refresh

**Decision:** Use one shared refresh promise in the mobile API client.

**Reasoning:**

Concurrent API requests can receive 401 responses at the same time.

Without coordination, multiple refresh requests could race while rotating a single-use token.

**Status:** Accepted

---

## ADR-010: Separate Google Identity Records

**Decision:** Store external Google identity separately from the application user.

**Reasoning:**

- Supports multiple identity providers in the future.
- Separates external identity from internal user identity.
- Makes account-linking behavior explicit.
- Prevents silent account merging.

**Status:** Accepted

---

## ADR-011: Idempotent Job Mutations

**Decision:** Use idempotency protection for retryable job mutations.

**Reasoning:**

Mobile clients can lose connectivity after submitting a request but before receiving its response.

Retrying the same operation must not apply the same mutation repeatedly.

**Status:** Accepted

---

## ADR-012: Version-Aware Job Synchronization

**Decision:** Use version information to detect stale updates.

**Reasoning:**

Multiple devices may update the same job independently.

Version-aware updates prevent silent overwrites and provide a foundation for explicit conflict resolution.

**Status:** Accepted

---

## ADR-013: Redis and BullMQ for Background Processing

**Decision:** Use Redis and BullMQ for asynchronous notification processing.

**Reasoning:**

- Decouples processing from HTTP request latency.
- Supports retryable jobs.
- Provides queue state management.
- Allows worker processes to operate independently.
- Supports controlled concurrency.

**Trade-offs:**

- Redis becomes an infrastructure dependency.
- Workers need graceful shutdown and recovery handling.
- Queue delivery and provider delivery are separate states.

**Status:** Accepted

---

## ADR-014: Separate Notification Dispatcher Process

**Decision:** Run notification dispatching separately from the HTTP API.

**Reasoning:**

- Isolates background processing.
- Allows independent process lifecycle management.
- Prevents request handling from becoming responsible for long-running dispatch cycles.
- Supports future horizontal scaling.

**Status:** Accepted

---

## ADR-015: Transactional Synchronization Checkpoints

**Decision:** Persist downloaded synchronization data and its cursor checkpoint transactionally.

**Reasoning:**

Advancing a cursor before persisting the corresponding data can permanently skip server changes after a crash.

The cursor must only advance when the associated page has been committed locally.

**Status:** Accepted
