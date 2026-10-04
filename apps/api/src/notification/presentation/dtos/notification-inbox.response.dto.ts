import { notificationInboxResponseSchema } from "@aido/validators";
import type { z } from "zod";

export const NotificationInboxResponseDto = notificationInboxResponseSchema.meta({
	id: "NotificationInboxResponseDto",
});
export type NotificationInboxResponseDto = z.infer<typeof NotificationInboxResponseDto>;
