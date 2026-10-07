import { notificationOpenedResponseSchema } from "@aido/api";
import type { z } from "zod";

export const NotificationOpenedResponseDto = notificationOpenedResponseSchema.meta({
  id: "NotificationOpenedResponseDto",
});
export type NotificationOpenedResponseDto = z.infer<typeof NotificationOpenedResponseDto>;
