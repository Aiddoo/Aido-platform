/**
 * 읽지 않은 알림 수 응답 DTO
 */
import { unreadCountResponseSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class UnreadCountResponseDto extends createZodDto(
	unreadCountResponseSchema,
) {}
