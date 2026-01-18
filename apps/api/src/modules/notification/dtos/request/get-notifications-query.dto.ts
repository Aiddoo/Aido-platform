/**
 * 알림 목록 조회 쿼리 DTO
 */
import { getNotificationsQuerySchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class GetNotificationsQueryDto extends createZodDto(
	getNotificationsQuerySchema,
) {}
