# Field Service App

## Project Goal

Build a production-oriented, offline-first field service mobile application using React Native, Expo, TypeScript, and a RESTful backend.

The application is designed around real-world workflows for field-based professionals such as technicians, engineers, and service teams.

## Primary Goals

- Build a cross-platform mobile application for iOS and Android.
- Learn React Native and Expo through real implementation.
- Implement offline-first application architecture.
- Implement local data storage.
- Implement reliable data synchronization.
- Implement conflict detection and resolution.
- Integrate GPS and location-based features.
- Integrate camera and device capabilities.
- Build REST API integrations.
- Implement mobile performance optimization.
- Implement mobile CI/CD and deployment workflows.
- Build a production-oriented portfolio project.

## Core Features

- Authentication
- Field jobs
- Job details
- Site check-in
- GPS/location tracking
- Inspection forms
- Offline data capture
- Camera/photo capture
- Local data storage
- Synchronization
- Retry handling
- Conflict resolution
- Maps/location visualization
- Notifications
- Job completion

## Technology

### Mobile

- React Native
- Expo
- TypeScript
- Zustand
- SQLite / local persistence for the offline-first milestone

### Backend

- Node.js
- Express
- TypeScript
- MongoDB
- Mongoose

### Development

- Git
- GitHub
- Vitest
- Supertest
- OpenAPI / Swagger
- CI/CD
- Expo Application Services

## Current Phase

Authentication baseline completed; moving into the offline-first local persistence milestone.

## Current Milestone

Authentication documentation and branch-history cleanup.

## Completed

- [x] GitHub repository created
- [x] Repository cloned locally
- [x] Initial Git commit exists
- [x] Project documentation structure created
- [x] Backend API initialized
- [x] Jobs API implemented
- [x] Job ownership implemented
- [x] Email/password authentication
- [x] Google authentication
- [x] Access-token / refresh-token session model
- [x] Refresh-token rotation and reuse detection
- [x] Mobile session persistence and restoration
- [x] OpenAPI / Swagger authentication documentation
- [x] Authentication refresh-mutex hardening

## In Progress

- [ ] Finalize authentication documentation on `main`
- [ ] Remove authentication-only history from `feature/offline-local-db`
- [ ] Restore the stashed Offline-Local-DB work

## Next

1. Finish authentication documentation on `main`.
2. Clean the feature branch history.
3. Restore the Offline-Local-DB stash.
4. Complete and test the first SQLite persistence slice.
5. Continue toward synchronization and conflict resolution.

## Authentication Baseline

The canonical detailed authentication design is documented in:

```text
docs/AUTHENTICATION.md
```

The machine-readable API contract is:

```text
apps/api/docs/openapi.yaml
```
