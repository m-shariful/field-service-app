# Architecture

## Overview

The application follows a layered architecture with an authentication-aware REST backend and a mobile-first client.

The long-term direction is offline-first, but the current local database/synchronization milestone is still under active development.

## High-Level Architecture

```text
React Native / Expo Mobile App
            |
            v
       UI / Screens
            |
            v
     State / Hooks
            |
            v
       Repository
            |
            +----------------------+
            |                      |
            v                      v
        Local DB             REST API Client
            |                      |
            |                      v
            |                 Access Token
            |                      |
            |                 Refresh Flow
            |                      |
            +----------------------+
                                   |
                                   v
                             Express API
                                   |
                     +-------------+-------------+
                     |                           |
                     v                           v
               Authentication               Job APIs
                     |                           |
                     v                           v
                  MongoDB                    MongoDB
```

## Backend

The backend is:

- Node.js
- Express
- TypeScript
- Mongoose
- MongoDB

The API exposes REST resources under `/api`.

## Authentication Boundary

Authentication is intentionally split into clear responsibilities.

### Mobile API client

Responsible for:

- credential attachment
- `401` handling
- token refresh
- refresh-request de-duplication
- retrying the original request

### Mobile auth store

Responsible for:

- authenticated user state
- initialization
- local credential lifecycle
- sign-out

### Backend auth service

Responsible for:

- password verification
- Google ID-token verification
- JWT creation
- refresh-session creation
- refresh rotation
- reuse detection
- revocation
- session lifetime

### MongoDB

Stores:

- users
- external authentication identities
- refresh-session records
- jobs

## Authorization

The authenticated user is derived from the bearer access token.

Job ownership is enforced server-side.

Clients must not be trusted to choose the `userId` used for ownership.

## Offline-First Direction

The target architecture is:

```text
UI
 ↓
Jobs Store
 ↓
Local Repository
 ↓
SQLite
 ↓
Sync Engine
 ↓
REST API
 ↓
MongoDB
```

The offline layer will eventually introduce:

- local jobs
- sync queue
- synchronization metadata
- retry handling
- conflict detection
- conflict resolution

This layer should remain below the UI so that online and offline behavior share the same repository-facing contract.
