import { AI_REPORT_TYPES } from "@aido/api/vocabulary";
import { z } from "zod";

import { defineQueue, JOB_POLLING_SECONDS } from "#api/shared/application/ports/job-queue.port";

import type { ReportType } from "../../domain/ai-report.constants.js";

export const AiReportJobKey = {
  dispatch: (type: ReportType, periodId: string) => `dispatch_${type}_${periodId}`,
  generate: (type: ReportType, userId: string, periodId: string) =>
    `report_${type}_${userId}_${periodId}`,
} as const;

export const AiReportJobName = {
  DISPATCH: "dispatch-reports",
  GENERATE: "generate-report",
} as const;

/**
 * 리포트 생성 잡 재시도 정책. AI 일시 오류는 잡 재시도로 다시 생성하고,
 * 마지막 시도에서만 폴백을 저장한다. 첫 시도 포함 총 retryLimit + 1회다.
 */
const AI_REPORT_RETRY_LIMIT = 3;

/** 1부터 세는 시도 번호가 마지막 재시도인지 판단한다. */
export function isFinalReportAttempt(attempt: number): boolean {
  return attempt > AI_REPORT_RETRY_LIMIT;
}

export const AiReportRuntimeJobSchema = z.discriminatedUnion("name", [
  z.object({
    name: z.literal(AiReportJobName.DISPATCH),
    data: z.object({ reportType: z.enum(AI_REPORT_TYPES) }),
  }),
  z.object({
    name: z.literal(AiReportJobName.GENERATE),
    data: z.object({
      userId: z.string().min(1),
      timezone: z.string().min(1),
      /** 생성 언어 — 없으면 ko (구버전 잡 하위 호환) */
      locale: z.string().optional(),
      reportType: z.enum(AI_REPORT_TYPES),
    }),
  }),
]);

export type AiReportRuntimeJob = z.infer<typeof AiReportRuntimeJobSchema>;

/**
 * 매시 5분에 디스패치하고 사용자 로컬 기준 새 주기 시작 직후인 사용자만 등록한다.
 * KST 고정 cron은 서쪽 시간대 사용자에게 아직 끝나지 않은 주기를 "지난 주기"로 만들었다.
 */
const HOURLY_DISPATCH_CRON = "5 * * * *";

export const AI_REPORT_QUEUE = defineQueue({
  name: "ai-report-generation.v1",
  payloadSchema: AiReportRuntimeJobSchema,
  retry: {
    retryLimit: AI_REPORT_RETRY_LIMIT,
    retryDelaySeconds: 30,
    retryBackoff: true,
    expireInSeconds: 10 * 60,
    retentionSeconds: 7 * 24 * 60 * 60,
    deleteAfterSeconds: 7 * 24 * 60 * 60,
  },
  // 백그라운드 AI 호출 자리(ai:background 2)보다 많이 꺼내면 작업이 꺼낸 채 자리를 기다리다 만료된다
  worker: { localConcurrency: 2, pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND },
  schedules: [
    {
      key: "weekly-report-scheduler",
      cron: HOURLY_DISPATCH_CRON,
      timezone: "UTC",
      missed: "once",
      payload: { name: AiReportJobName.DISPATCH, data: { reportType: "WEEKLY" } },
    },
    {
      key: "monthly-report-scheduler",
      cron: HOURLY_DISPATCH_CRON,
      timezone: "UTC",
      missed: "once",
      payload: { name: AiReportJobName.DISPATCH, data: { reportType: "MONTHLY" } },
    },
  ],
});

export interface ReportDispatcher {
  dispatchReports(reportType: ReportType): Promise<void>;
}
