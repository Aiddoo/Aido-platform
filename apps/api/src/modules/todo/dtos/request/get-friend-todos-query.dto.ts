import { getTodosQuerySchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

const getFriendTodosQuerySchema = getTodosQuerySchema.pick({
	cursor: true,
	size: true,
	startDate: true,
	endDate: true,
});

export class GetFriendTodosQueryDto extends createZodDto(
	getFriendTodosQuerySchema,
) {}
