# Development Guide

## 1. Prerequisites

Recommended development environment:

- Node.js 24.x
- npm
- Git
- MongoDB
- Redis
- Docker
- Android Studio for Android development
- Expo development tooling

## 2. Repository Layout

```text
field-service-app/
├── apps/
│   ├── api/
│   └── mobile/
├── docs/
└── README.md
```

The API and mobile application are maintained as separate application packages.

## 3. Backend Development

Navigate to the API directory:

```bash
cd apps/api
```

Install dependencies:

```bash
npm install
```

Create `.env` from `.env.example` and configure the required environment variables.

Example:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/field-service
JWT_SECRET=replace-with-a-secure-secret
GOOGLE_CLIENT_ID=your-google-client-id
REDIS_URL=redis://127.0.0.1:6380
```

The actual configuration may include additional variables. Check the backend bootstrap and configuration modules before starting the application.

Start the development API:

```bash
npm run dev
```

Run the backend type checker:

```bash
npx tsc --noEmit
```

Run tests:

```bash
npx vitest run
```

## 4. Redis and Background Processing

Redis is used by BullMQ for notification background processing.

The local Redis instance may be managed through Docker Compose.

The project uses a dedicated Redis host port to avoid interfering with unrelated local Redis services.

The configured application URL should match the actual Redis container port mapping.

Start the dispatcher independently:

```bash
npm run dispatcher:dev
```

The dispatcher is not the same process as the HTTP API.

Run it only after Redis and MongoDB are available.

## 5. Mobile Development

Navigate to the mobile application:

```bash
cd apps/mobile
```

Install dependencies:

```bash
npm install
```

Configure:

```env
EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_NETWORK_IP:5000
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-google-web-client-id
```

Start Expo:

```bash
npx expo start
```

For a physical device, the API URL must point to an address reachable over the local network.

`localhost` inside a physical device refers to that device itself, not the development computer.

## 6. Environment Variables

Never commit:

- Database credentials
- JWT secrets
- Google credentials
- Production API keys
- Device tokens
- Private certificates

Use `.env.example` to document variable names without exposing actual values.

Mobile variables prefixed with `EXPO_PUBLIC_` are bundled into the client application. They must never contain private secrets.

## 7. API Documentation

The OpenAPI specification is maintained at:

```text
apps/api/docs/openapi.yaml
```

Swagger setup is integrated into the backend.

Keep the API contract synchronized with route and response changes.

## 8. Development Workflow

Recommended feature workflow:

1. Start from the appropriate feature branch.
2. Inspect the existing architecture.
3. Implement a cohesive feature.
4. Run type checking.
5. Run relevant automated tests.
6. Verify runtime behavior.
7. Review the staged diff.
8. Commit with a descriptive message.
9. Push the branch.

Do not commit environment secrets or unrelated local changes.

## 9. Git Conventions

Suggested branch names:

```text
feature/authentication
feature/offline-sync
feature/background-jobs
feature/notification-client
fix/synchronization-state
```

Suggested commit messages:

```text
feat(notifications): add notification inbox
fix(sync): preserve pending mutations during pull
test(auth): cover refresh token reuse
docs: update system architecture
```

## 10. Troubleshooting

### API cannot connect to MongoDB

Verify MongoDB is running and the configured URI is correct.

### API cannot connect to Redis

Verify the Redis container is running and that `REDIS_URL` uses the correct host port.

### Physical device cannot reach API

Use the development machine's LAN IP address instead of `localhost`.

### TypeScript cannot resolve an Expo Router route

Check that the route file exists in the configured Expo Router app directory. Restart Expo and the TypeScript language server to refresh generated typed-route information.

### Android emulator is unresponsive

Check the emulator process, Android Debug Bridge, and virtual device health before assuming the application itself is responsible.
