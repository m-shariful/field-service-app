# Testing Strategy

## 1. Objectives

Testing focuses on correctness, reliability, and recovery behavior.

The most important workflows are:

- Authentication
- Session lifecycle
- Job authorization
- Job mutation
- Offline persistence
- Synchronization
- Conflict handling
- Notification processing

## 2. Backend Testing Stack

- Vitest
- Supertest
- MongoDB Memory Server
- TypeScript

The API test suite exercises HTTP endpoints and service-level behavior.

## 3. Running Tests

Type checking:

```bash
npx tsc --noEmit
```

Complete test suite:

```bash
npx vitest run
```

Single test file:

```bash
npx vitest run path/to/test-file.test.ts
```

Watch mode:

```bash
npx vitest
```

## 4. Authentication Test Coverage

Important scenarios:

- Successful registration
- Duplicate account registration
- Valid login
- Invalid credentials
- Google ID-token validation
- Account-link-required behavior
- Access-token authentication
- Expired access token
- Successful refresh
- Refresh-token rotation
- Refresh-token reuse detection
- Session-family revocation
- Idle timeout
- Absolute timeout
- Logout revocation
- User deletion/session invalidation

## 5. Job API Test Coverage

Important scenarios:

- Authenticated job listing
- Job detail retrieval
- Unauthorized access
- Cross-user access prevention
- Valid status transition
- Invalid status transition
- Stale version rejection
- Duplicate idempotency key
- Retry of an existing mutation
- Job deletion and synchronization behavior

## 6. Offline Synchronization Test Coverage

Important scenarios:

- Persist a local job
- Persist a local mutation
- Preserve pending mutations after restart
- Retry a failed mutation
- Prevent duplicate mutation application
- Pull cursor-paginated server changes
- Commit page data and cursor transactionally
- Preserve cursor after failed persistence
- Detect version conflicts
- Resolve conflicts
- Preserve remaining mutations after acknowledgement
- Recover synchronization after connectivity returns

## 7. Notification Test Coverage

Important scenarios:

- Create notification
- Prevent duplicate event notifications
- Retrieve a user's notifications
- Prevent cross-user notification access
- Retrieve unread count
- Mark one notification as read
- Mark all notifications as read
- Register a device token
- Deactivate a device token
- Claim a pending notification
- Prevent concurrent dispatch claims
- Recover expired dispatcher leases
- Process a queued notification
- Prevent concurrent processing
- Recover expired worker leases
- Retry failed delivery processing
- Handle terminal failure

Provider acceptance and confirmed device delivery must be tested separately once provider integration is implemented.

## 8. Mobile Testing

Type checking:

```bash
npx tsc --noEmit
```

Feature-level runtime verification should include:

- Authentication restoration
- Login and logout
- Job list and details
- Offline reads
- Local mutation persistence
- Sync after connectivity restoration
- Conflict resolution
- Notification inbox
- Read-state updates
- Navigation from notification to job

## 9. Reliability Testing

Beyond happy paths, test interruption and recovery:

- Terminate the app during synchronization.
- Restart after a locally persisted mutation.
- Simulate network failure after request submission.
- Retry a request with the same idempotency key.
- Update the same job from multiple devices.
- Stop a background worker during processing.
- Restart the worker and verify lease recovery.
- Make Redis temporarily unavailable.

## 10. Test Execution Principles

- Run targeted tests during implementation.
- Run the full backend suite before merging major backend changes.
- Run type checking after cohesive implementation chunks.
- Verify critical workflows at runtime.
- Do not mark a feature complete based only on compilation.
- Document unverified behavior honestly.
