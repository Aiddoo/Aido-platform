import type { NotificationType } from "@aido/api/vocabulary";

import type { BroadcastAction } from "../../domain/broadcast-campaign.aggregate.js";

export type AdminBroadcastType = Extract<NotificationType, "ADMIN_BROADCAST" | "ADMIN_TARGETED">;

export interface AdminBroadcastMessage {
  readonly userId: string;
  readonly type: AdminBroadcastType;
  readonly title: string;
  readonly body: string;
  readonly action?: BroadcastAction;
  readonly metadata?: { readonly externalUrl: string };
  readonly force: boolean;
  readonly campaignKey?: string;
}
