import {
  deactivateDeviceToken,
  getEnabledDeviceTokens,
} from "./notification.service";

import {
  PermanentNotificationDeliveryError,
  type NotificationDeliveryHandler,
} from "./notification-delivery.service";

import type { DeviceToken } from "../models/device-token";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const MAX_BATCH_SIZE = 100;

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: {
    error?: string;
  };
}

interface ExpoPushResponse {
  data?: ExpoPushTicket | ExpoPushTicket[];
  errors?: Array<{
    code?: string;
    message?: string;
  }>;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound: "default";
  priority: "high";
  channelId: "default";
  data: Record<string, unknown>;
}

function getExpoAccessToken(): string | undefined {
  return process.env.EXPO_ACCESS_TOKEN?.trim() || undefined;
}

function isExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);
}

function getTicketErrorCode(ticket: ExpoPushTicket): string {
  return ticket.details?.error ?? "UNKNOWN_EXPO_ERROR";
}

function getTicketErrorMessage(ticket: ExpoPushTicket): string {
  return ticket.message ?? "Expo rejected the notification";
}

async function sendExpoBatch(
  messages: ExpoPushMessage[],
): Promise<ExpoPushTicket[]> {
  const accessToken = getExpoAccessToken();

  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(messages),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");

    if (response.status === 429 || response.status >= 500) {
      throw new Error(
        `EXPO_PUSH_TEMPORARY_HTTP_${response.status}: ${responseBody.slice(0, 300)}`,
      );
    }

    throw new PermanentNotificationDeliveryError(
      `EXPO_PUSH_HTTP_${response.status}: ${responseBody.slice(0, 300)}`,
    );
  }

  let payload: ExpoPushResponse;

  try {
    payload = (await response.json()) as ExpoPushResponse;
  } catch {
    throw new Error("EXPO_PUSH_INVALID_JSON_RESPONSE");
  }

  if (payload.errors?.length) {
    const firstError = payload.errors[0];

    throw new Error(
      `EXPO_PUSH_RESPONSE_ERROR: ${firstError?.code ?? "UNKNOWN"}: ${
        firstError?.message ?? "Unknown response error"
      }`,
    );
  }

  const tickets = Array.isArray(payload.data)
    ? payload.data
    : payload.data
      ? [payload.data]
      : [];

  if (tickets.length !== messages.length) {
    throw new Error("EXPO_PUSH_TICKET_COUNT_MISMATCH");
  }

  return tickets;
}

export const deliverExpoPushNotification: NotificationDeliveryHandler = async (
  notification,
) => {
  const devices = await getEnabledDeviceTokens(notification.userId);

  if (devices.length === 0) {
    return { status: "skipped" };
  }

  const validDevices: DeviceToken[] = [];
  const transientErrors: string[] = [];

  for (const device of devices) {
    if (!isExpoPushToken(device.token)) {
      await deactivateDeviceToken(notification.userId, device.token);
      continue;
    }

    validDevices.push(device);
  }

  if (validDevices.length === 0) {
    return { status: "skipped" };
  }

  const acceptedTickets: Array<{
    ticketId: string;
    deviceToken: string;
    status: "pending";
  }> = [];

  let permanentFailures = 0;

  for (let offset = 0; offset < validDevices.length; offset += MAX_BATCH_SIZE) {
    const batch = validDevices.slice(offset, offset + MAX_BATCH_SIZE);

    const messages: ExpoPushMessage[] = batch.map((device) => ({
      to: device.token,
      title: notification.title,
      body: notification.body,
      sound: "default",
      priority: "high",
      channelId: "default",
      data: {
        ...(notification.data ?? {}),
        notificationId: notification.id,
        type: notification.type,
        jobId: notification.jobId ?? null,
      },
    }));

    const tickets = await sendExpoBatch(messages);

    for (let index = 0; index < tickets.length; index += 1) {
      const ticket = tickets[index];
      const device = batch[index];

      if (!ticket || !device) {
        throw new Error("EXPO_PUSH_TICKET_MAPPING_FAILED");
      }

      if (ticket.status === "ok" && ticket.id) {
        acceptedTickets.push({
          ticketId: ticket.id,
          deviceToken: device.token,
          status: "pending",
        });

        continue;
      }

      const errorCode = getTicketErrorCode(ticket);
      const errorMessage = getTicketErrorMessage(ticket);

      if (
        errorCode === "DeviceNotRegistered" ||
        errorCode === "InvalidPushToken"
      ) {
        await deactivateDeviceToken(notification.userId, device.token);
        permanentFailures += 1;
        continue;
      }

      if (errorCode === "InvalidCredentials" || errorCode === "MessageTooBig") {
        throw new PermanentNotificationDeliveryError(
          `${errorCode}: ${errorMessage}`,
        );
      }

      // Rate limits and unknown provider errors should be retried.
      // if (acceptedTickets.length === 0) {
      //   throw new Error(`${errorCode}: ${errorMessage}`);
      // }
      transientErrors.push(`${errorCode}: ${errorMessage}`);

      console.error(
        `[Expo Push] Partial failure for notification ${notification.id}: ${errorCode}`,
      );
    }
  }

  if (acceptedTickets.length === 0) {
    if (transientErrors.length > 0) {
      throw new Error(transientErrors[0]);
    }

    if (permanentFailures > 0) {
      return { status: "skipped" };
    }

    throw new Error("EXPO_PUSH_NO_ACCEPTED_TICKETS");
  }

  // Log transient errors for accepted tickets, but don't fail the delivery.
  if (transientErrors.length > 0) {
    console.error(
      `[Expo Push] Partial failures for notification ${notification.id}:`,
      transientErrors,
    );
  }

  return {
    status: "accepted",
    providerTicketIds: acceptedTickets.map((ticket) => ticket.ticketId),
    providerTickets: acceptedTickets,
  };
};
