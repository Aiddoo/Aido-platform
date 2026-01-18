/**
 * 알림 목록 응답 DTO
 */
import { notificationListResponseSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class NotificationListResponseDto extends createZodDto(
	notificationListResponseSchema,
) {}
