import { z } from "zod";

import { dateSchema, nullableDatetimeSchema } from "../../../common/datetime.js";

/** 성장/리텐션 cohort 달성 지표 */
export const growthCohortMetricSchema = z
  .object({
    eligible: z.int().nonnegative().meta({ description: "측정 가능한 cohort 사용자 수" }),
    achieved: z.int().nonnegative().meta({ description: "목표 행동을 달성한 사용자 수" }),
    rate: z.number().min(0).max(100).meta({ description: "달성률 (0-100%)" }),
  })
  .meta({ description: "성장/리텐션 cohort 달성 지표" });

/** 관리자 성장 지표 요약 응답 */
export const growthSummaryResponseSchema = z
  .object({
    cohortFrom: dateSchema.meta({ description: "적용된 가입 cohort 시작 현지 날짜" }),
    cohortTo: dateSchema.meta({ description: "적용된 가입 cohort 종료 현지 날짜" }),
    measurementStartedAt: nullableDatetimeSchema.meta({ description: "첫 활동 일 측정 시각" }),
    totalActiveUsers: z
      .int()
      .nonnegative()
      .meta({ description: "cohort 기간 내 순 활동 사용자 수" }),
    signups: z.int().nonnegative().meta({ description: "cohort 기간 내 가입자 수" }),
    dau: z.int().nonnegative().meta({ description: "종료 현지 날짜의 순 활동 사용자 수" }),
    wau: z
      .int()
      .nonnegative()
      .meta({ description: "종료 현지 날짜 포함 최근 7일 순 활동 사용자 수" }),
    mau: z
      .int()
      .nonnegative()
      .meta({ description: "종료 현지 날짜 포함 최근 30일 순 활동 사용자 수" }),
    stickiness: z
      .number()
      .min(0)
      .max(100)
      .meta({ description: "DAU/MAU 비율 (0-100%, 소수 둘째 자리). MAU가 0이면 0" }),
    activation24h: growthCohortMetricSchema.meta({
      description: "가입 후 24시간 내 Todo 생성 및 완료 지표",
    }),
    d1: growthCohortMetricSchema
      .nullable()
      .meta({ description: "가입 다음 현지 날짜 활동 리텐션" }),
    d7: growthCohortMetricSchema
      .nullable()
      .meta({ description: "가입 후 7번째 현지 날짜 활동 리텐션" }),
    d30: growthCohortMetricSchema
      .nullable()
      .meta({ description: "가입 후 30번째 현지 날짜 활동 리텐션" }),
    d7RetainedActivatedUsers: z
      .int()
      .nonnegative()
      .nullable()
      .meta({ description: "24시간 내 활성화하고 D7에도 활동한 사용자 수" }),
  })
  .meta({
    description: "관리자 성장 지표 요약",
    example: {
      cohortFrom: "2026-06-26",
      cohortTo: "2026-07-25",
      measurementStartedAt: "2026-06-15T00:12:34.000Z",
      totalActiveUsers: 120,
      signups: 40,
      dau: 35,
      wau: 90,
      mau: 120,
      stickiness: 29.17,
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
 * - successCount: 발송 대기열에 올린 수 (전달 성공 수 아님)
 * - failCount: 대기열에 올리지 못한 수
 * - totalTargets: 대상 사용자 수
 */
export const broadcastResultSchema = z
  .object({
    successCount: z.int().nonnegative().meta({
      description:
        "알림을 만들어 발송 대기열에 올린 수. 전달 성공 수가 아니며 전달 결과는 v2 캠페인 조회로 확인한다",
    }),
    failCount: z.int().nonnegative().meta({ description: "대상 중 대기열에 올리지 못한 수" }),
    totalTargets: z.int().nonnegative().meta({ description: "접수 시점의 대상 사용자 수" }),
  })
  .meta({
    description: "알림 브로드캐스트 결과",
    example: {
      successCount: 148,
      failCount: 2,
      totalTargets: 150,
    },
  });

export type BroadcastResult = z.infer<typeof broadcastResultSchema>;
