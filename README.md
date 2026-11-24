# Field Service Management App

An offline-first field service management application designed for technicians, engineers, and field teams working in environments where connectivity cannot always be guaranteed.

The project explores production-oriented mobile and backend engineering through real-world workflows, including job management, authentication, offline persistence, synchronization, conflict resolution, and asynchronous background processing.

**Status:** Active development

## Overview

Field service professionals frequently work outside reliable network coverage. A mobile application that depends entirely on a live API connection can interrupt important workflows and risk losing field data.

This project addresses that problem through a local-first mobile architecture backed by a REST API and a synchronization system.

The goal is to build a reliable foundation where users can access and update job information, retain local changes, and synchronize them with the backend when connectivity becomes available.

## Core Capabilities

### Authentication and Session Management

- Email and password authentication
- Google authentication
- Short-lived JWT access tokens
- Opaque refresh tokens
- Refresh-token rotation
- Session-family tracking
- Refresh-token reuse detection
- Idle and absolute session expiration
- Mobile session restoration
- Automatic token refresh with single-flight coordination

### Job Management

- Authenticated job listing
- Job details
- Job lifecycle management
- Job status updates
- Server-side job ownership enforcement
- Version-aware updates
- Idempotent mutation handling

### Offline-First Synchronization

- Local SQLite persistence
- Durable local mutation queue
- Background synchronization
- Cursor-based server pagination
- Transactional synchronization checkpoints
- Retry handling
- Idempotency protection
- Version-aware conflict detection
- Conflict resolution

### Notification Infrastructure

- Notification persistence and retrieval APIs
- Unread notification count
- Mark-one and mark-all-as-read operations
- Device token registration and deactivation
- Redis and BullMQ-based background processing
- Notification dispatching and delivery-processing infrastructure
- Retry and failure handling

The mobile notification experience and end-to-end push-provider delivery workflow remain under development.

## Technology Stack

| Area              | Technologies                             |
| ----------------- | ---------------------------------------- |
| Mobile            | React Native, Expo, TypeScript           |
| Navigation        | Expo Router                              |
| State management  | Zustand                                  |
| Local persistence | Expo SQLite                              |
| Secure storage    | Expo SecureStore                         |
| Backend           | Node.js, Express, TypeScript             |
| Database          | MongoDB, Mongoose                        |
| Background jobs   | BullMQ                                   |
| Queue storage     | Redis                                    |
| Authentication    | JWT, bcryptjs, Google Identity           |
| API documentation | OpenAPI, Swagger                         |
| Testing           | Vitest, Supertest, MongoDB Memory Server |
| Development       | Git, GitHub, Docker                      |

## Architecture

The application follows a layered architecture.

The mobile application communicates with the backend through an authenticated REST API. Local repositories provide a persistence boundary between application workflows and storage. The synchronization layer coordinates local mutations with the server.

The backend owns authentication, authorization, job persistence, synchronization endpoints, and asynchronous notification processing.

See [Architecture](docs/ARCHITECTURE.md) for details.

## Repository Structure

```text
field-service-app/
├── apps/
│   ├── mobile/       # Expo / React Native application
│   └── api/          # Express REST API
│
├── docs/             # Engineering documentation
│
├── README.md
├── CHANGELOG.md
└── ...
```

## Getting Started

### Prerequisites

- Node.js 24.x
- npm
- MongoDB
- Redis
- Docker (recommended for local Redis)
- Expo development environment
- Android Studio / Android emulator or a compatible device

### Backend Setup

```bash
cd apps/api
npm install
```

Create an environment file based on the environment example:

```bash
cp .env.example .env
```

Configure the required environment variables:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/field-service
JWT_SECRET=replace-with-a-secure-secret
GOOGLE_CLIENT_ID=your-google-client-id
REDIS_URL=redis://127.0.0.1:6380
```

Use the actual environment-variable names defined by the current application configuration. Never commit real secrets.

Start the API:

```bash
npm run dev
```

The health endpoint is available at:

```text
GET http://localhost:5000/health
```

### Background Notification Dispatcher

The notification dispatcher is a separate process from the HTTP API.

Start it using:

```bash
npm run dispatcher
```

For development:

```bash
npm run dispatcher:dev
```

Redis must be available before starting the dispatcher.

### Mobile Setup

```bash
cd apps/mobile
npm install
```

Configure the mobile environment:

```env
EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_NETWORK_IP:5000
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-google-web-client-id
```

For a physical device, use the computer's LAN IP address rather than `localhost`.

Start Expo:

```bash
npx expo start
```

See [Development Guide](docs/DEVELOPMENT.md) for environment and runtime details.

## Testing

Backend:

```bash
cd apps/api
npx tsc --noEmit
npx vitest run
```

Mobile:

```bash
cd apps/mobile
npx tsc --noEmit
```

See [Testing Guide](docs/TESTING.md) for test strategy and additional verification scenarios.

## Engineering Focus

This project emphasizes more than CRUD implementation.

Key engineering concerns include:

- Offline data consistency
- Reliable synchronization
- Idempotent distributed mutations
- Concurrent update handling
- Authentication session security
- Background job processing
- Retry and failure recovery
- Clear separation of responsibilities
- Automated testing and maintainability

## Project Status

The project is actively evolving.

Implemented foundations include authentication, job management, local persistence, synchronization, conflict handling, and backend notification infrastructure.

The remaining work includes completing the mobile notification experience, push-provider integration and reconciliation, and additional field-device capabilities.

For current implementation status, see:

- [Project State](PROJECT_STATE.md)
- [Current Milestone](CURRENT_MILESTONE.md)
- [Roadmap](docs/ROADMAP.md)

## License

No license has been specified yet. All rights remain with the repository owner unless a license is added.
