import { z } from 'zod';
import { dateSchema, nullableDatetimeSchema } from '../../common/datetime';

/** 성장/리텐션 cohort 달성 지표 */
export const growthCohortMetricSchema = z
  .object({
    eligible: z.number().int().nonnegative().describe('측정 가능한 cohort 사용자 수'),
    achieved: z.number().int().nonnegative().describe('목표 행동을 달성한 사용자 수'),
    rate: z.number().min(0).max(100).describe('달성률 (0-100%)'),
  })
  .describe('성장/리텐션 cohort 달성 지표');

/** 관리자 성장 지표 요약 응답 */
export const growthSummaryResponseSchema = z
  .object({
    cohortFrom: dateSchema.describe('적용된 가입 cohort 시작 현지 날짜'),
    cohortTo: dateSchema.describe('적용된 가입 cohort 종료 현지 날짜'),
    measurementStartedAt: nullableDatetimeSchema.describe('첫 활동 일 측정 시각'),
    totalActiveUsers: z.number().int().nonnegative().describe('cohort 기간 내 순 활동 사용자 수'),
    signups: z.number().int().nonnegative().describe('cohort 기간 내 가입자 수'),
    dau: z.number().int().nonnegative().describe('종료 현지 날짜의 순 활동 사용자 수'),
    wau: z.number().int().nonnegative().describe('종료 현지 날짜 포함 최근 7일 순 활동 사용자 수'),
    mau: z.number().int().nonnegative().describe('종료 현지 날짜 포함 최근 30일 순 활동 사용자 수'),
    activation24h: growthCohortMetricSchema.describe('가입 후 24시간 내 Todo 생성 및 완료 지표'),
    d1: growthCohortMetricSchema.nullable().describe('가입 다음 현지 날짜 활동 리텐션'),
    d7: growthCohortMetricSchema.nullable().describe('가입 후 7번째 현지 날짜 활동 리텐션'),
    d30: growthCohortMetricSchema.nullable().describe('가입 후 30번째 현지 날짜 활동 리텐션'),
    d7RetainedActivatedUsers: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .describe('24시간 내 활성화하고 D7에도 활동한 사용자 수'),
  })
  .describe('관리자 성장 지표 요약')
  .meta({
    example: {
      cohortFrom: '2026-06-26',
      cohortTo: '2026-07-25',
      measurementStartedAt: '2026-06-15T00:12:34.000Z',
      totalActiveUsers: 120,
      signups: 40,
      dau: 35,
      wau: 90,
      mau: 120,
      activation24h: { eligible: 40, achieved: 22, rate: 55 },
      d1: { eligible: 40, achieved: 18, rate: 45 },
      d7: { eligible: 30, achieved: 9, rate: 30 },
      d30: null,
      d7RetainedActivatedUsers: 7,
    },
  });

export type GrowthSummaryResponse = z.infer<typeof growthSummaryResponseSchema>;

/**
 * 알림 브로드캐스트 결과 응답
 *
 * - successCount: 성공적으로 발송된 알림 수
 * - failCount: 발송 실패한 알림 수
 * - totalTargets: 전체 대상 사용자 수
 */
export const broadcastResultSchema = z
  .object({
    successCount: z.number().int().nonnegative().describe('성공적으로 발송된 알림 수'),
    failCount: z.number().int().nonnegative().describe('발송 실패한 알림 수'),
    totalTargets: z.number().int().nonnegative().describe('전체 대상 사용자 수'),
  })
  .describe('알림 브로드캐스트 결과')
  .meta({
    example: {
      successCount: 148,
      failCount: 2,
      totalTargets: 150,
    },
  });

export type BroadcastResult = z.infer<typeof broadcastResultSchema>;
