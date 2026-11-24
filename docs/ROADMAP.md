# Project Roadmap

This roadmap separates implemented foundations from remaining engineering work.

## Phase 1 — Project Foundation

**Status: Completed**

- [x] Repository initialization
- [x] Mobile project foundation
- [x] Backend project foundation
- [x] TypeScript configuration
- [x] Expo Router
- [x] REST API foundation
- [x] MongoDB integration

## Phase 2 — Authentication and Session Management

**Status: Completed**

- [x] Email/password registration
- [x] Login
- [x] Password hashing
- [x] Google ID-token verification
- [x] JWT access tokens
- [x] Opaque refresh tokens
- [x] Refresh-token rotation
- [x] Session families
- [x] Reuse detection
- [x] Idle expiration
- [x] Absolute expiration
- [x] Logout revocation
- [x] Mobile session persistence
- [x] Session restoration
- [x] Single-flight refresh

## Phase 3 — Job Management

**Status: Implemented**

- [x] Job listing
- [x] Job details
- [x] Job status lifecycle
- [x] Ownership enforcement
- [x] Version-aware updates
- [x] Idempotency
- [x] Job API validation
- [x] Backend tests

## Phase 4 — Offline-First Foundation

**Status: Implemented**

- [x] SQLite integration
- [x] Local job repository
- [x] Durable mutation persistence
- [x] Synchronization queue
- [x] Retry handling
- [x] Server synchronization
- [x] Cursor pagination
- [x] Transactional cursor updates
- [x] Conflict detection
- [x] Conflict resolution
- [x] Background synchronization registration
- [x] Synchronization diagnostics

## Phase 5 — Notification Infrastructure

**Status: Backend infrastructure implemented; client and provider integration in progress**

- [x] Notification model
- [x] Notification API
- [x] Unread count
- [x] Read-state management
- [x] Device token registration
- [x] Device token deactivation
- [x] Redis configuration
- [x] BullMQ queue
- [x] Dispatcher process
- [x] Delivery-processing infrastructure
- [x] Processing leases
- [x] Retry and failure handling
- [ ] Mobile notification inbox
- [ ] Mobile unread badge
- [ ] Push-provider delivery
- [ ] Provider ticket reconciliation
- [ ] Provider receipt processing
- [ ] Invalid token cleanup
- [ ] End-to-end notification verification

## Phase 6 — Field Device Capabilities

**Status: Planned**

- [ ] GPS permission handling
- [ ] Current location capture
- [ ] Job-site check-in
- [ ] Geospatial job information
- [ ] Camera integration
- [ ] Inspection photo attachments
- [ ] Inspection forms
- [ ] Background location workflows where appropriate

## Phase 7 — Production Engineering

**Status: Planned / partially established**

- [x] Automated backend tests
- [x] Type checking
- [x] API documentation
- [ ] CI pipeline
- [ ] Mobile build automation
- [ ] Centralized logging
- [ ] Error tracking
- [ ] Performance monitoring
- [ ] Rate limiting
- [ ] Operational health checks
- [ ] Deployment strategy
- [ ] Backup and recovery strategy

## Phase 8 — Product Readiness

**Status: Planned**

- [ ] UX refinement
- [ ] Accessibility review
- [ ] Offline usability review
- [ ] Performance profiling
- [ ] Security review
- [ ] Android release build
- [ ] iOS release build
- [ ] Demonstration environment
- [ ] Screenshots and product walkthrough

## Definition of Done

A feature is complete when:

1. Its implementation is integrated.
2. Its expected behavior is verified.
3. Important failure paths are handled.
4. Relevant tests pass.
5. Type checking passes.
6. Documentation reflects actual behavior.
7. Its Git changes are committed and pushed when appropriate.
