import { z } from "zod";

import {
  defineQueue,
  JOB_POLLING_SECONDS,
  type JobRetryPolicy,
} from "#api/shared/application/ports/job-queue.port";
import { DAY_SECONDS } from "#api/shared/domain/time/time-units";

import {
  SUGGESTION_ANALYSIS_TRIGGERS,
  type SuggestionAnalysisTrigger,
} from "../../domain/suggestion-analysis.constants.js";

export const AiSuggestionJobKey = {
  /** UTC 시각 단위. 같은 시각의 정기 실행과 재시작 보정이 한 번만 돈다 */
  dispatch: (hourId: string) => `dispatch_suggestion_${hourId}`,
  /** 사용자 현지 날짜 단위. 같은 날 두 번 분석·알림하지 않는다 */
  analyze: (userId: string, localDate: string) => `suggestion_${userId}_${localDate}`,
} as const;

export const AiSuggestionJobName = {
  DISPATCH: "dispatch-analysis",
  ANALYZE: "analyze-suggestion",
} as const;

// 옛 런타임이 남긴 { name, data } 모양을 그대로 받는다
export const AiSuggestionRuntimeJobSchema = z.discriminatedUnion("name", [
  z.object({ name: z.literal(AiSuggestionJobName.DISPATCH), data: z.object({}) }),
  z.object({
    name: z.literal(AiSuggestionJobName.ANALYZE),
    data: z.object({
      userId: z.string().min(1),
      timezone: z.string().min(1),
      localDate: z.iso.date(),
      trigger: z.enum(SUGGESTION_ANALYSIS_TRIGGERS),
    }),
  }),
]);

export type AiSuggestionRuntimeJob = z.infer<typeof AiSuggestionRuntimeJobSchema>;
export type AiSuggestionAnalyzeData = Extract<
  AiSuggestionRuntimeJob,
  { name: typeof AiSuggestionJobName.ANALYZE }
>["data"];

// 지금 받기 전용 worker가 minPriority로 이 값 이상만 가져가 아침 배치 적체에 밀리지 않는다
export const AI_SUGGESTION_PRIORITY = {
  SCHEDULED: 0,
  ON_DEMAND: 10,
} as const satisfies Record<SuggestionAnalysisTrigger, number>;

const AI_SUGGESTION_RETRY_LIMIT = 2;

// 1부터 세는 시도 번호다. 첫 시도 포함 총 retryLimit + 1회다
export function isFinalSuggestionAttempt(attempt: number): boolean {
  return attempt > AI_SUGGESTION_RETRY_LIMIT;
}

const AI_SUGGESTION_JOB_RETRY = {
  retryLimit: AI_SUGGESTION_RETRY_LIMIT,
  retryDelaySeconds: 5,
  retryBackoff: true,
  expireInSeconds: 10 * 60,
  retentionSeconds: DAY_SECONDS,
  deleteAfterSeconds: 7 * DAY_SECONDS,
} as const satisfies JobRetryPolicy;

/**
 * 매시 정각에 사용자 현지 제안 창(09시대)인 사용자를 고른다(리포트 디스패치와 같은 방식).
 * 배포로 빠진 실행은 한 번 보내고(once), 사용자별 현지 날짜 키가 같은 날 두 번째 분석을 막는다.
 */
export const AI_SUGGESTION_QUEUE = defineQueue({
  name: "ai-suggestion-analysis.v1",
  payloadSchema: AiSuggestionRuntimeJobSchema,
  retry: AI_SUGGESTION_JOB_RETRY,
  // 백그라운드 AI 호출 자리(ai:background 2)보다 많이 꺼내면 작업이 꺼낸 채 자리를 기다리다 만료된다
  worker: { localConcurrency: 2, pollingIntervalSeconds: JOB_POLLING_SECONDS.BACKGROUND },
  schedules: [
    {
      key: "daily-suggestion-scheduler",
      // 다음 분석 시각(nextSuggestionDispatchAt)이 UTC 매시 정각 회차로 계산하므로 함께 바꾼다
      cron: "0 * * * *",
      timezone: "UTC",
      missed: "once",
      payload: { name: AiSuggestionJobName.DISPATCH, data: {} },
    },
  ],
});

// 같은 큐의 두 번째 worker. 사용자가 앱에서 기다리는 지금 받기만 가져간다
export const AI_SUGGESTION_ON_DEMAND_WORKER = defineQueue({
  ...AI_SUGGESTION_QUEUE,
  worker: {
    localConcurrency: 1,
    pollingIntervalSeconds: JOB_POLLING_SECONDS.INTERACTIVE,
    minPriority: AI_SUGGESTION_PRIORITY.ON_DEMAND,
  },
});
