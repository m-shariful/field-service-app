# Project State

**Project:** Field Service Management App  
**Repository:** `m-shariful/field-service-app`  
**Development status:** Active

## Current Technical Foundation

### Mobile

- React Native
- Expo SDK 57
- TypeScript
- Expo Router
- Zustand
- Expo SQLite
- Expo SecureStore
- Expo BackgroundTask

### Backend

- Node.js
- Express 5
- TypeScript
- MongoDB
- Mongoose
- Redis
- BullMQ
- Vitest
- Supertest

## Completed Engineering Areas

### Authentication

Implemented email/password and Google authentication, JWT access tokens, opaque refresh-token rotation, session families, reuse detection, timeout enforcement, logout revocation, and mobile session restoration.

### Job Management

Implemented authenticated job workflows, ownership enforcement, status changes, version-aware updates, and idempotency support.

### Offline-First Synchronization

Implemented local SQLite persistence, durable mutation handling, cursor-based synchronization, transactional checkpoint updates, retries, conflict detection, and conflict resolution.

### Notification Backend

Implemented notification APIs, device-token management, Redis/BullMQ infrastructure, a separate dispatcher, and delivery-processing reliability mechanisms.

## Current Work

Notification client implementation.

The next work includes:

1. Complete the mobile notification inbox.
2. Resolve typed-route and navigation issues.
3. Verify unread counts and read-state updates.
4. Integrate the push provider.
5. Implement provider ticket and receipt reconciliation.
6. Verify end-to-end delivery behavior.

## Known Boundaries

- Notification provider delivery is not yet fully verified.
- Provider acceptance must not be described as confirmed device delivery.
- Mobile notification UX is still in progress.
- GPS, camera, inspection forms, and geospatial workflows remain planned.
- Production CI/CD and observability remain future work.

## Quality Requirements

- Type checking must pass.
- Relevant tests must pass.
- Runtime behavior must be verified.
- Failure paths must be considered.
- Documentation must match implementation.
- No unverified performance claims or fabricated metrics.
