import {
	broadcastNotificationSchema,
	growthSummaryQuerySchema,
	targetedNotificationSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

/**
 * 전체 알림 발송 요청 DTO
 */
export class BroadcastNotificationDto extends createZodDto(broadcastNotificationSchema) {}

/**
 * 특정 사용자 알림 발송 요청 DTO
 */
export class TargetedNotificationDto extends createZodDto(targetedNotificationSchema) {}

/** 관리자 성장 지표 요약 쿼리 DTO */
export class GrowthSummaryQueryDto extends createZodDto(growthSummaryQuerySchema) {}
