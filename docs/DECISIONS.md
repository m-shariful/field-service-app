---

# Step 18 — `DECISIONS.md`

```md
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

## ADR-002: Offline-First Mobile Architecture

### Decision

The mobile application will use a local-first/offline-first approach.

### Reason

Field professionals may operate in environments with
unreliable or unavailable network connectivity.

### Consequences

The system must support:

- Local persistence
- Synchronization
- Retry handling
- Conflict detection
- Conflict resolution
- Idempotency

### Status

Accepted

---

## ADR-003: REST API

### Decision

Use REST APIs for communication between the mobile application
and backend.

### Reason

- Clear resource-oriented architecture
- Easy debugging
- Familiar production pattern
- Suitable for mobile clients

### Status

Accepted
