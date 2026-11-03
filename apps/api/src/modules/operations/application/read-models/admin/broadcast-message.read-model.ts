import type { NotificationAction } from "@aido/api";

export type AdminBroadcastType = "ADMIN_BROADCAST" | "ADMIN_TARGETED";

export interface AdminBroadcastMessage {
  readonly userId: string;
  readonly type: AdminBroadcastType;
  readonly title: string;
  readonly body: string;
  readonly action?: NotificationAction;
  readonly metadata?: { readonly externalUrl: string };
  readonly force: boolean;
  readonly campaignKey?: string;
}
