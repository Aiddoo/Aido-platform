import type { AdminNotification } from "../../read-models/notifications/admin-notification.read-model.js";

export interface AdminNotifyResult {
  readonly success: boolean;
  readonly error?: string;
}

export interface AdminNotifier {
  readonly name: string;
  send(notification: AdminNotification): Promise<AdminNotifyResult>;
}

export const ADMIN_NOTIFIER = Symbol("ADMIN_NOTIFIER");
export const PAYMENT_NOTIFIER = Symbol("PAYMENT_NOTIFIER");
