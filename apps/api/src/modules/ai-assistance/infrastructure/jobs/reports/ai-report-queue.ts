import { z } from "zod";

import { JOB_POLLING_SECONDS } from "#api/shared/application/ports/index";

export const AI_REPORT_QUEUE = "ai-report-generation.v1";
export const AI_REPORT_LEGACY_QUEUE = "ai-report-generation";

export const AiReportSchedulerName = {
  WEEKLY: "weekly-report-scheduler",
  MONTHLY: "monthly-report-scheduler",
} as const;

export const AiReportJobKey = {
  dispatch: (type: AiReportDispatchData["reportType"], periodId: string) =>
    `dispatch_${type}_${periodId}`,
  generate: (type: AiReportDispatchData["reportType"], userId: string, periodId: string) =>
    `report_${type}_${userId}_${periodId}`,
} as const;

/** 잡 이름 상수 */
export const AiReportJobName = {
  DISPATCH: "dispatch-reports",
  GENERATE: "generate-report",
} as const;

/**
 * 리포트 생성 잡 재시도 정책. AI 일시 오류는 잡 재시도로 다시 생성하고,
 * 마지막 시도에서만 폴백을 저장한다. 첫 시도 포함 총 retryLimit + 1회다.
 */
export const AI_REPORT_JOB_RETRY_POLICY = {
  retryLimit: 3,
  retryDelaySeconds: 30,
  retryBackoff: true,
} as const;

/** 1부터 세는 시도 번호가 마지막 재시도인지 판단한다. */
export function isFinalReportAttempt(attempt: number): boolean {
  return attempt > AI_REPORT_JOB_RETRY_POLICY.retryLimit;
}

export const AI_REPORT_WORKER_POLICY = {
  teamSize: 5,
  pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND,
} as const;

export const AiReportRuntimeJobSchema = z.discriminatedUnion("name", [
  z.object({
    name: z.literal(AiReportJobName.DISPATCH),
    data: z.object({ reportType: z.enum(["WEEKLY", "MONTHLY"]) }),
  }),
  z.object({
    name: z.literal(AiReportJobName.GENERATE),
    data: z.object({
      userId: z.string().min(1),
      timezone: z.string().min(1),
      locale: z.string().optional(),
      reportType: z.enum(["WEEKLY", "MONTHLY"]),
    }),
  }),
]);

/** 스케줄러가 생성하는 dispatch 트리거 잡 데이터 */
export interface AiReportDispatchData {
  reportType: "WEEKLY" | "MONTHLY";
}

/** per-user 리포트 생성 잡 데이터 */
export interface AiReportGenerateData {
  userId: string;
  timezone: string;
  /** 생성 언어 — 없으면 ko (구버전 잡 하위 호환) */
  locale?: string;
  reportType: "WEEKLY" | "MONTHLY";
}

/** 잡 이름 → 데이터 타입 매핑 */
export interface AiReportJobMap {
  [AiReportJobName.DISPATCH]: AiReportDispatchData;
  [AiReportJobName.GENERATE]: AiReportGenerateData;
}

export type AiReportJobData = AiReportJobMap[keyof AiReportJobMap];
export type AiReportRuntimeJob = z.infer<typeof AiReportRuntimeJobSchema>;

export interface ReportDispatcher {
  dispatchReports(reportType: AiReportDispatchData["reportType"]): Promise<void>;
}
