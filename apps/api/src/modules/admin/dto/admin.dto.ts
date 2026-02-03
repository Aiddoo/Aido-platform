import {
	broadcastNotificationSchema,
	broadcastResultSchema,
	targetedNotificationSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

/**
 * 전체 알림 발송 요청 DTO
 */
export class BroadcastNotificationDto extends createZodDto(
	broadcastNotificationSchema,
) {}

/**
 * 특정 사용자 알림 발송 요청 DTO
 */
export class TargetedNotificationDto extends createZodDto(
	targetedNotificationSchema,
) {}

/**
 * 알림 발송 결과 응답 DTO
 */
export class BroadcastResultDto extends createZodDto(broadcastResultSchema) {}
