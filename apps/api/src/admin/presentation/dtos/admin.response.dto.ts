import {
	broadcastResultSchema,
	growthSummaryResponseSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

/**
 * 알림 발송 결과 응답 DTO
 */
export class BroadcastResultDto extends createZodDto(broadcastResultSchema) {}

/** 관리자 성장 지표 요약 응답 DTO */
export class GrowthSummaryResponseDto extends createZodDto(
	growthSummaryResponseSchema,
) {}
