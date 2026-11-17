import {
  broadcastNotificationSchema,
  broadcastResultSchema,
  targetedNotificationSchema,
} from "@aido/api/contracts/admin";
import type { z } from "zod";

export const BroadcastNotificationDto = broadcastNotificationSchema.meta({
  id: "BroadcastNotificationDto",
});
export type BroadcastNotificationDto = z.infer<typeof BroadcastNotificationDto>;

export const TargetedNotificationDto = targetedNotificationSchema.meta({
  id: "TargetedNotificationDto",
});
export type TargetedNotificationDto = z.infer<typeof TargetedNotificationDto>;

export const BroadcastResultDto = broadcastResultSchema.meta({ id: "BroadcastResultDto" });
export type BroadcastResultDto = z.infer<typeof BroadcastResultDto>;
