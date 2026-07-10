import { getNotificationsQuerySchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class GetNotificationsQueryDto extends createZodDto(
	getNotificationsQuerySchema,
) {}
