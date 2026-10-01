import { notificationIdParamSchema } from "@aido/validators";
import type { z } from "zod";

export const NotificationIdParamDto = notificationIdParamSchema.meta({
	id: "NotificationIdParamDto",
	apiParameter: true,
});
export type NotificationIdParamDto = z.infer<typeof NotificationIdParamDto>;
