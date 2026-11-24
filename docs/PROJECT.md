# Project Definition and Implementation Status

## Project Goal

Build a production-oriented offline-first field service management application for technicians, engineers, and field teams.

The project combines mobile application engineering, backend development, distributed synchronization, authentication, and asynchronous processing.

## Problem Statement

Field service professionals often operate outside reliable network coverage.

A network-dependent application can prevent users from accessing job details, recording updates, and completing field operations.

This project aims to provide a resilient workflow where local operations remain available and synchronize with the backend when connectivity returns.

## Target Users

- Field technicians
- Maintenance engineers
- Inspection teams
- Construction and utility professionals
- Field service coordinators

## Primary Engineering Objectives

1. Build a cross-platform React Native application.
2. Implement secure authentication and session management.
3. Build job management workflows.
4. Implement durable offline persistence.
5. Build reliable synchronization.
6. Handle concurrent updates and conflicts.
7. Implement asynchronous backend processing.
8. Integrate mobile device capabilities.
9. Establish automated testing and CI/CD practices.

## Implemented Capabilities

### Authentication

- Email/password authentication
- Google authentication
- JWT access tokens
- Opaque refresh tokens
- Refresh rotation
- Session families
- Reuse detection
- Idle and absolute expiration
- Logout revocation
- Mobile session restoration
- Single-flight refresh

### Job Management

- Job listing
- Job details
- Job lifecycle updates
- Authenticated access
- Ownership enforcement
- Version-aware mutations
- Idempotency handling

### Offline Synchronization

- SQLite persistence
- Local job repository
- Durable mutation queue
- Retry handling
- Cursor-based synchronization
- Transactional checkpoint updates
- Conflict detection
- Conflict resolution
- Background sync registration

### Notification Backend

- Notification persistence
- Notification retrieval API
- Unread counts
- Read-state updates
- Device-token management
- Redis/BullMQ queue infrastructure
- Separate dispatcher
- Delivery-processing infrastructure
- Lease-based processing
- Retry and failure handling

## In Progress

- Mobile notification inbox and navigation
- Mobile unread notification experience
- Push-provider integration
- Provider ticket and receipt reconciliation
- Invalid device-token cleanup

## Planned Capabilities

- GPS and location workflows
- Camera-based inspection attachments
- Inspection forms
- Geospatial job visualization
- Rich notification interactions
- Production observability
- Deployment automation
- Performance optimization

## Non-Functional Requirements

### Reliability

Local operations should survive temporary connectivity loss and application restarts.

### Security

Protected operations must be authenticated and authorized by the backend.

### Consistency

Synchronization must account for duplicate requests, stale versions, and conflicting changes.

### Maintainability

The application should maintain clear boundaries between UI, repositories, services, and infrastructure.

### Testability

Business-critical logic should be independently testable.

## Project Principles

- Never claim an unimplemented feature as completed.
- Prefer explicit failure handling over silent recovery.
- Persist important operations before asynchronous execution.
- Keep authorization decisions on the backend.
- Use idempotency for retryable operations.
- Keep synchronization rules outside the UI.
- Verify each milestone before moving to the next.

## Current Development Direction

Complete the notification experience and provider integration, then improve documentation, observability, device capabilities, and deployment readiness.
