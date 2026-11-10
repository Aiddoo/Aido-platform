import type { NotificationAction } from "@aido/api";

import type {
  AdminBroadcastMessage,
  AdminBroadcastType,
} from "../read-models/broadcast-message.read-model.js";

export interface BroadcastMessageInput {
  readonly title: string;
  readonly body: string;
  readonly type: AdminBroadcastType;
  readonly action: NotificationAction | null | undefined;
  readonly force: boolean;
  readonly campaignKey?: string;
}

export function buildBroadcastMessages(
  input: BroadcastMessageInput,
  userIds: readonly string[],
): AdminBroadcastMessage[] {
  const { action } = input;
  return userIds.map((userId) => ({
    userId,
    type: input.type,
    title: input.title,
    body: input.body,
    action: action == null ? undefined : { ...action },
    metadata: action?.url ? { externalUrl: action.url } : undefined,
    force: input.force,
    ...(input.campaignKey != null && { campaignKey: input.campaignKey }),
  }));
}
