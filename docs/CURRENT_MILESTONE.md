# Current Milestone

## Notification Client and Push Delivery

**Status:** In progress

## Objective

Connect the existing notification backend infrastructure to the mobile application and complete the user-facing notification workflow.

## Backend Foundation

- [x] Notification persistence
- [x] Notification list API
- [x] Unread count API
- [x] Mark-one-as-read API
- [x] Mark-all-as-read API
- [x] Device registration API
- [x] Device deactivation API
- [x] Redis integration
- [x] BullMQ queue
- [x] Dispatcher process
- [x] Delivery-processing infrastructure
- [x] Processing lease recovery
- [x] Retry and failure handling

## Mobile Client

- [x] Notification types and API data layer
- [x] Notification API service layer
- [ ] Notification inbox screen
- [ ] Notification pagination
- [ ] Pull-to-refresh
- [ ] Mark notification as read
- [ ] Mark all as read
- [ ] Unread badge
- [ ] Navigation to related jobs
- [ ] Runtime verification

## Push Delivery

- [ ] Expo Push API integration
- [ ] Provider ticket handling
- [ ] Receipt reconciliation
- [ ] Invalid token cleanup
- [ ] Delivery-state verification
- [ ] End-to-end testing

## Acceptance Criteria

The milestone is complete when:

1. A notification can be created from a supported business event.
2. The notification appears in the authenticated user's inbox.
3. The user can retrieve unread counts.
4. Read-state changes persist on the backend.
5. Notification interactions navigate correctly.
6. Device registration works.
7. Background processing submits notifications to the configured provider.
8. Provider responses are reconciled correctly.
9. Invalid device tokens are handled.
10. Relevant automated tests and mobile runtime checks pass.

## Important Delivery Semantics

The following states are not interchangeable:

- `pending`: waiting for processing.
- `queued`: submitted to the queue.
- `processing`: currently being processed.
- `accepted`: provider accepted the request.
- `delivered`: delivery confirmation has been recorded.
- `failed`: processing or delivery failed.
- `skipped`: delivery was intentionally not performed.

A provider acceptance response alone does not prove that a device received the notification.
