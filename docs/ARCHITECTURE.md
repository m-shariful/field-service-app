# System Architecture

## 1. Overview

The Field Service Management App uses a mobile-first, offline-first architecture backed by an authenticated REST API.

The system is designed for field professionals who may operate with intermittent or unavailable network connectivity.

The architecture separates:

- User interface
- Application state
- Local persistence
- Synchronization
- API communication
- Authentication and authorization
- Backend business logic
- Asynchronous background processing

## 2. High-Level Architecture

```text
                  Mobile Application
              React Native / Expo / TypeScript
                           |
                           v
                    UI / Screens
                           |
                           v
                  Application State
                       Zustand
                           |
                           v
                    Repositories
                      /       \
                     v         v
               SQLite DB    API Client
                  |              |
                  |              v
                  |       Authentication
                  |       Access / Refresh
                  |              |
                  +-------> Express API
                                 |
             +-------------------+-------------------+
             |                   |                   |
             v                   v                   v
        Auth Services       Job Services      Notification APIs
             |                   |                   |
             +-------------------+-------------------+
                                 |
                              MongoDB
                                 |
                                 v
                       Notification Outbox
                                 |
                                 v
                       Dispatcher Process
                                 |
                                 v
                           Redis / BullMQ
                                 |
                                 v
                       Delivery Processing
                                 |
                                 v
                         Push Provider
                       (integration work)
```

The diagram describes the intended end-to-end notification architecture. Provider integration and delivery reconciliation are not yet considered complete.

## 3. Mobile Architecture

### 3.1 UI Layer

Responsible for:

- Rendering application screens
- Handling user interactions
- Displaying loading and error states
- Presenting job and synchronization status

The UI should not directly own persistence or synchronization rules.

### 3.2 Application State

Zustand manages application-level state.

Responsibilities include:

- Authentication state
- User session state
- UI-related state
- Feature-level state where appropriate

Persistent domain data should be managed through repository boundaries rather than relying solely on in-memory state.

### 3.3 Repository Layer

Repositories abstract local and remote data access.

The offline-first job repository coordinates:

- Local reads
- Local writes
- Mutation persistence
- Server synchronization
- Conflict state
- Synchronization metadata

The repository boundary allows the UI to work with local data without requiring a successful network request for every operation.

### 3.4 Local Database

Expo SQLite provides durable local storage.

The local database is responsible for preserving job data and pending mutations across application restarts.

Important properties:

- Durable persistence
- Transactional updates
- Synchronization metadata
- Mutation ordering
- Local version tracking

## 4. Offline-First Synchronization

### 4.1 Design Principle

The local database is the primary source for immediate mobile interaction.

Network connectivity is not assumed to be continuously available.

```text
User Action
    |
    v
Local Repository
    |
    v
SQLite Transaction
    |
    +----> UI observes local state
    |
    v
Pending Mutation Queue
    |
    v
Sync Engine
    |
    v
REST API
    |
    v
MongoDB
```

### 4.2 Mutation Queue

Local changes are persisted before attempting remote synchronization.

This prevents a temporary network failure from discarding user work.

The synchronization process must preserve mutation identity and retry safety.

### 4.3 Idempotency

A mutation may be retried when the client does not receive a successful response.

Without idempotency, the same operation could be applied multiple times.

The backend therefore supports idempotency for relevant job mutation workflows.

### 4.4 Cursor-Based Pull Synchronization

The client retrieves server changes through cursor-based pagination.

A synchronization checkpoint must only advance when the corresponding page has been safely persisted locally.

This is implemented through transactional page and cursor updates.

### 4.5 Conflict Detection

A conflict can occur when the server and local device modify the same job independently.

The system uses version-aware updates to detect stale mutations.

Conflict handling must preserve the server's authoritative version and avoid silently overwriting unrelated changes.

### 4.6 Conflict Resolution

The mobile application maintains enough information to identify and resolve conflicting mutations.

Conflict resolution must be explicit and deterministic.

The synchronization layer should distinguish between:

- Pending local changes
- Successfully synchronized changes
- Conflicting changes
- Failed changes requiring retry or intervention

## 5. Backend Architecture

The backend uses:

- Node.js
- Express
- TypeScript
- MongoDB
- Mongoose

The application separates routes, controllers, services, models, middleware, and infrastructure.

### Responsibilities

**Routes**

Define API endpoints and middleware composition.

**Controllers**

Translate HTTP requests into service operations and responses.

**Services**

Contain application and business logic.

**Models**

Define persistence structures and database-level constraints.

**Middleware**

Handle authentication, authorization, validation, and error processing.

## 6. Authentication Architecture

The backend uses:

- bcrypt password hashing
- Google ID-token verification
- Short-lived JWT access tokens
- Opaque refresh tokens
- Refresh-token rotation
- Session-family tracking
- Reuse detection
- Idle and absolute session expiration

The mobile API client coordinates token refresh using a single-flight mechanism to prevent concurrent refresh races.

Detailed design: [Authentication Architecture](AUTHENTICATION.md).

## 7. Notification Architecture

Notification processing is separated from the HTTP request lifecycle.

### Components

**Notification API**

Provides notification retrieval, unread counts, read-state updates, and device-token management.

**Notification persistence**

Stores user-facing notification records and internal delivery state.

**Dispatcher**

Finds eligible pending notifications and submits background jobs.

**Redis**

Provides queue storage and coordination.

**BullMQ**

Manages asynchronous processing, job state, and retry behavior.

**Delivery processing**

Claims notifications, manages processing leases, and handles delivery attempts.

### Processing Flow

```text
Business Event
     |
     v
Notification Record
     |
     v
Pending Notification
     |
     v
Dispatcher
     |
     v
BullMQ Queue
     |
     v
Delivery Processor
     |
     v
Push Provider Integration
     |
     v
Delivery Reconciliation
```

The dispatcher and queue-processing infrastructure are implemented. Actual provider delivery and receipt reconciliation remain future implementation work.

An accepted provider request must not be interpreted as confirmed device delivery.

## 8. Reliability Principles

The architecture considers the following failure scenarios:

- Network unavailable
- Application terminated during a pending mutation
- Duplicate API requests
- Concurrent refresh requests
- Stale job versions
- Worker interruption
- Expired processing leases
- Queue failures
- Retriable delivery failures

The goal is to make state transitions recoverable and observable rather than assuming every operation succeeds immediately.

## 9. Security Boundaries

- Access tokens are required for protected API operations.
- User identity is derived from authentication credentials.
- Job ownership is enforced by the backend.
- Refresh-token plaintext is not persisted in the backend database.
- Device tokens must be associated with authenticated users.
- Notification metadata is not an authorization mechanism.
- Environment secrets must not be committed to source control.

## 10. Future Architecture Extensions

Potential extensions include:

- GPS and geospatial workflows
- Camera and inspection attachments
- Background location capabilities
- Push-provider integration
- Notification receipt reconciliation
- Monitoring and observability
- Deployment automation
- Multi-tenant organization support
