import { notificationInboxResponseSchema } from "@aido/api";
import type { z } from "zod";

export const NotificationInboxResponseDto = notificationInboxResponseSchema.meta({
  id: "NotificationInboxResponseDto",
});
export type NotificationInboxResponseDto = z.infer<typeof NotificationInboxResponseDto>;
