import { getNotificationsQuerySchema } from "@aido/validators";
import type { z } from "zod";

export const GetNotificationsQueryDto = getNotificationsQuerySchema.meta({
	id: "GetNotificationsQueryDto",
	apiParameter: true,
});
export type GetNotificationsQueryDto = z.infer<typeof GetNotificationsQueryDto>;
