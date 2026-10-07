import { notificationListResponseSchema } from "@aido/api";
import type { z } from "zod";

export const NotificationListResponseDto = notificationListResponseSchema.meta({
  id: "NotificationListResponseDto",
});
export type NotificationListResponseDto = z.infer<typeof NotificationListResponseDto>;
