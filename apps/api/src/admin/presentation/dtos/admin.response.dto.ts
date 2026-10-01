import { broadcastResultSchema, growthSummaryResponseSchema } from "@aido/validators";
import type { z } from "zod";

/**
 * 알림 발송 결과 응답 DTO
 */
export const BroadcastResultDto = broadcastResultSchema.meta({ id: "BroadcastResultDto" });
export type BroadcastResultDto = z.infer<typeof BroadcastResultDto>;

/** 관리자 성장 지표 요약 응답 DTO */
export const GrowthSummaryResponseDto = growthSummaryResponseSchema.meta({
	id: "GrowthSummaryResponseDto",
});
export type GrowthSummaryResponseDto = z.infer<typeof GrowthSummaryResponseDto>;
