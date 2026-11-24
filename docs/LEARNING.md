# Engineering Learning Progress

This document tracks engineering concepts explored through implementation.

It is not intended to represent mastery based only on exposure. A topic should be marked complete only after implementation and meaningful verification.

## 1. Mobile Engineering

### React Native

- [x] Expo application foundation
- [x] Expo Router navigation
- [x] Component-based UI
- [ ] Advanced list performance
- [ ] Accessibility
- [ ] Platform-specific optimization
- [ ] Native debugging
- [ ] Performance profiling

### Expo

- [x] Expo development workflow
- [x] Development builds
- [x] SecureStore integration
- [x] SQLite integration
- [x] Background task registration
- [ ] EAS Build
- [ ] EAS Submit
- [ ] Production deployment

### State and Persistence

- [x] Zustand
- [x] Repository pattern
- [x] SQLite persistence
- [x] Transactional operations
- [x] Local mutation queue
- [x] Synchronization metadata

## 2. Authentication and Security

- [x] Password hashing
- [x] JWT access tokens
- [x] Opaque refresh tokens
- [x] Token hashing
- [x] Refresh-token rotation
- [x] Session families
- [x] Reuse detection
- [x] Idle timeout
- [x] Absolute timeout
- [x] Logout revocation
- [x] Google ID-token verification
- [x] Account-linking boundaries
- [x] Secure mobile session storage
- [x] Single-flight token refresh
- [ ] Rate limiting
- [ ] Password recovery
- [ ] Advanced session-management UX
- [ ] Security audit

## 3. Backend Engineering

- [x] Express architecture
- [x] REST API design
- [x] TypeScript
- [x] MongoDB
- [x] Mongoose
- [x] Request validation
- [x] Error handling
- [x] Ownership authorization
- [x] OpenAPI documentation
- [x] Integration testing

## 4. Distributed Systems and Offline Engineering

- [x] Durable local mutations
- [x] Idempotency
- [x] Cursor-based synchronization
- [x] Transactional checkpoint updates
- [x] Version-aware updates
- [x] Conflict detection
- [x] Conflict resolution
- [x] Retry handling
- [x] Background synchronization
- [ ] Advanced synchronization observability
- [ ] Multi-device stress testing

## 5. Background Processing

- [x] Redis configuration
- [x] BullMQ queue infrastructure
- [x] Separate dispatcher process
- [x] Delivery-processing workflow
- [x] Processing leases
- [x] Retry and failure handling
- [ ] Push-provider integration
- [ ] Provider receipt reconciliation
- [ ] Invalid token cleanup
- [ ] Production worker monitoring

## 6. Testing and Quality

- [x] Vitest
- [x] Supertest
- [x] MongoDB Memory Server
- [x] Backend type checking
- [x] API integration tests
- [ ] Mobile automated test coverage
- [ ] End-to-end mobile testing
- [ ] Load testing
- [ ] Security testing

## 7. DevOps and Production Readiness

- [x] Git and GitHub
- [x] Docker-based Redis development
- [ ] GitHub Actions CI
- [ ] Mobile CI/CD
- [ ] Production deployment
- [ ] Centralized logs
- [ ] Error tracking
- [ ] Performance monitoring
- [ ] Backup and recovery

## 8. Field Device Capabilities

- [ ] GPS and location
- [ ] Geospatial workflows
- [ ] Camera
- [ ] Inspection attachments
- [ ] Sensors
- [ ] Background location
- [ ] Device permission handling

## Learning Principle

For every major topic:

1. Understand the underlying problem.
2. Study the engineering concepts.
3. Implement a working solution.
4. Test normal and failure scenarios.
5. Explain the design and trade-offs.
6. Document the decision and limitations.
