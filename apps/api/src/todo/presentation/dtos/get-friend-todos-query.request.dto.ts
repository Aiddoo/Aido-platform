import { getTodosQuerySchema } from "@aido/validators";
import type { z } from "zod";

const getFriendTodosQuerySchema = getTodosQuerySchema.pick({
	cursor: true,
	size: true,
	startDate: true,
	endDate: true,
});

export const GetFriendTodosQueryDto = getFriendTodosQuerySchema.meta({
	id: "GetFriendTodosQueryDto",
	apiParameter: true,
});
export type GetFriendTodosQueryDto = z.infer<typeof GetFriendTodosQueryDto>;
