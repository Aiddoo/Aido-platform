import { notificationOpenedResponseSchema } from "@aido/validators";
import type { z } from "zod";

export const NotificationOpenedResponseDto = notificationOpenedResponseSchema.meta({
  id: "NotificationOpenedResponseDto",
});
export type NotificationOpenedResponseDto = z.infer<typeof NotificationOpenedResponseDto>;
