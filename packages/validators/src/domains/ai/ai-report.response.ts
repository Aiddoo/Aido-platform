import { z } from 'zod';

import { datetimeSchema } from '../../common/datetime';

// ============================================================================
// AI 리포트 통계
// ============================================================================

export const reportStatsSchema = z.object({
  totalTodos: z.number().int().nonnegative().describe('총 할 일 수'),
  completedTodos: z.number().int().nonnegative().describe('완료한 할 일 수'),
  completionRate: z.number().min(0).max(100).describe('완료율 (0-100%)'),
  averageDailyTodos: z.number().nonnegative().describe('일 평균 할 일 수'),
  mostProductiveDay: z.string().nullable().describe('가장 생산적인 요일 (예: MON)'),
});

export type ReportStats = z.infer<typeof reportStatsSchema>;

export const categoryBreakdownItemSchema = z.object({
  categoryId: z.number().int().describe('카테고리 ID'),
  categoryName: z.string().describe('카테고리 이름'),
  categoryColor: z.string().describe('카테고리 색상 (HEX)'),
  totalTodos: z.number().int().nonnegative().describe('총 할 일 수'),
  completedTodos: z.number().int().nonnegative().describe('완료한 할 일 수'),
  completionRate: z.number().min(0).max(100).describe('완료율 (0-100%)'),
});

export type CategoryBreakdownItem = z.infer<typeof categoryBreakdownItemSchema>;

export const dayPatternItemSchema = z.object({
  day: z.string().describe('요일 (예: MON)'),
  totalTodos: z.number().int().nonnegative().describe('총 할 일 수'),
  completedTodos: z.number().int().nonnegative().describe('완료한 할 일 수'),
  completionRate: z.number().min(0).max(100).describe('완료율 (0-100%)'),
});

export type DayPatternItem = z.infer<typeof dayPatternItemSchema>;

export const timePatternItemSchema = z.object({
  hour: z.number().int().min(0).max(23).describe('시간대 (0-23)'),
  completedCount: z.number().int().nonnegative().describe('해당 시간대 완료 수'),
});

export type TimePatternItem = z.infer<typeof timePatternItemSchema>;

// ============================================================================
// AI 리포트 응답
// ============================================================================

export const aiReportSchema = z.object({
  id: z.number().int().describe('리포트 ID'),
  type: z.enum(['WEEKLY', 'MONTHLY']).describe('리포트 유형'),
  year: z.number().int().describe('연도'),
  period: z.number().int().describe('기간 (WEEKLY: 주차 1-53, MONTHLY: 월 1-12)'),
  stats: reportStatsSchema.describe('통계 데이터'),
  categoryBreakdown: z.array(categoryBreakdownItemSchema).describe('카테고리별 분석'),
  dayPatterns: z.array(dayPatternItemSchema).describe('요일별 패턴'),
  timePatterns: z.array(timePatternItemSchema).describe('시간대별 패턴'),
  aiSummary: z.string().describe('AI 요약'),
  aiTips: z.array(z.string()).describe('AI 개선 팁'),
  hasActivity: z.boolean().describe('활동 데이터 존재 여부'),
  generatedAt: datetimeSchema.describe('리포트 생성 시각'),
  createdAt: datetimeSchema.describe('레코드 생성 시각'),
});

export type AiReport = z.infer<typeof aiReportSchema>;

export const aiReportResponseSchema = z.object({
  success: z.literal(true).describe('조회 성공 여부 (항상 true)'),
  data: aiReportSchema.describe('AI 리포트 데이터'),
});

export type AiReportResponse = z.infer<typeof aiReportResponseSchema>;

export const aiReportListResponseSchema = z.object({
  success: z.literal(true).describe('조회 성공 여부 (항상 true)'),
  data: z.array(aiReportSchema).describe('AI 리포트 목록'),
});

export type AiReportListResponse = z.infer<typeof aiReportListResponseSchema>;

// ============================================================================
// 리포트 상태 (생성 가능 여부 확인용)
// ============================================================================

export const reportStatusSchema = z.object({
  type: z.enum(['WEEKLY', 'MONTHLY']).describe('리포트 유형'),
  year: z.number().int().describe('연도'),
  period: z.number().int().describe('기간'),
  exists: z.boolean().describe('이미 생성된 리포트 존재 여부'),
  hasActivity: z.boolean().describe('활동 데이터 존재 여부'),
});

export type ReportStatus = z.infer<typeof reportStatusSchema>;

export const reportStatusResponseSchema = z.object({
  success: z.literal(true).describe('조회 성공 여부 (항상 true)'),
  data: reportStatusSchema.describe('리포트 상태 정보'),
});

export type ReportStatusResponse = z.infer<typeof reportStatusResponseSchema>;

// ============================================================================
// 리포트 조회 쿼리
// ============================================================================

export const getAiReportsQuerySchema = z.object({
  type: z.enum(['WEEKLY', 'MONTHLY']).optional().describe('리포트 유형 필터'),
  year: z.coerce.number().int().optional().describe('연도 필터'),
});

export type GetAiReportsQuery = z.infer<typeof getAiReportsQuerySchema>;
