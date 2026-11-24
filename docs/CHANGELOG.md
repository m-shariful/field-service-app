# Changelog

Notable project changes are documented here.

The changelog focuses on meaningful feature and engineering milestones rather than every individual commit.

## Unreleased

### Notification Client

- Added notification feature data types.
- Added mobile notification API integration layer.
- Added notification service abstraction.
- Mobile inbox and navigation integration remain in progress.

### Documentation

- Expanded project overview.
- Documented current architecture.
- Recorded architectural decisions.
- Added development and testing guides.
- Added implementation status and roadmap documentation.

## Notification Backend

- Added notification persistence and APIs.
- Added unread count and read-state operations.
- Added device token management.
- Introduced Redis and BullMQ infrastructure.
- Added a separate notification dispatcher.
- Added delivery-processing and lease-recovery mechanisms.
- Added retry and failure handling.

## Offline-First Synchronization

- Added SQLite-based local persistence.
- Added durable local mutation handling.
- Implemented cursor-based synchronization.
- Added transactional synchronization checkpoints.
- Added idempotent mutation handling.
- Added version-aware conflict detection and resolution.
- Added background synchronization support.

## Authentication

- Added email/password authentication.
- Added Google ID-token authentication.
- Added JWT access tokens.
- Added opaque rotating refresh tokens.
- Added refresh-session families.
- Added refresh-token reuse detection.
- Added idle and absolute expiration.
- Added logout revocation.
- Added mobile session restoration.
- Added single-flight refresh handling.

## Job Management

- Added authenticated job listing and details.
- Added job lifecycle operations.
- Added ownership enforcement.
- Added version-aware updates and idempotency support.

## Project Foundation

- Initialized Expo / React Native application.
- Initialized Express / TypeScript backend.
- Added MongoDB integration.
- Added API documentation foundation.
