import {
  broadcastNotificationSchema,
  growthSummaryQuerySchema,
  targetedNotificationSchema,
} from "@aido/api";
import type { z } from "zod";

/**
 * 전체 알림 발송 요청 DTO
 */
export const BroadcastNotificationDto = broadcastNotificationSchema.meta({
  id: "BroadcastNotificationDto",
});
export type BroadcastNotificationDto = z.infer<typeof BroadcastNotificationDto>;

/**
 * 특정 사용자 알림 발송 요청 DTO
 */
export const TargetedNotificationDto = targetedNotificationSchema.meta({
  id: "TargetedNotificationDto",
});
export type TargetedNotificationDto = z.infer<typeof TargetedNotificationDto>;

/** 관리자 성장 지표 요약 쿼리 DTO */
export const GrowthSummaryQueryDto = growthSummaryQuerySchema.meta({
  id: "GrowthSummaryQueryDto",
  apiParameter: true,
});
export type GrowthSummaryQueryDto = z.infer<typeof GrowthSummaryQueryDto>;
