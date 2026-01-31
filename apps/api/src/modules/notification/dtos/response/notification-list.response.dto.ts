import { notificationListResponseSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class NotificationListResponseDto extends createZodDto(
	notificationListResponseSchema,
) {}
