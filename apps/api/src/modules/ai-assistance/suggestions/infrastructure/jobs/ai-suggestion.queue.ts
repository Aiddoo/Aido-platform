import { z } from "zod";

import {
  defineQueue,
  JOB_POLLING_SECONDS,
  type JobRetryPolicy,
} from "#api/shared/application/ports/job-queue.port";

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

const weatherGridSchema = z
  .object({ gridX: z.number(), gridY: z.number(), lat: z.number(), lon: z.number() })
  .nullable();

// 옛 런타임이 남긴 { name, data } 모양을 그대로 받는다
export const AiSuggestionRuntimeJobSchema = z.discriminatedUnion("name", [
  z.object({ name: z.literal(AiSuggestionJobName.DISPATCH), data: z.object({}) }),
  z.object({
    name: z.literal(AiSuggestionJobName.ANALYZE),
    data: z.object({
      userId: z.string().min(1),
      timezone: z.string().min(1),
      /** 날씨 조회용 KMA 격자 좌표 (위치 미설정·해외 위치면 null) */
      weatherGrid: weatherGridSchema,
    }),
  }),
]);

export type AiSuggestionRuntimeJob = z.infer<typeof AiSuggestionRuntimeJobSchema>;
export type AiSuggestionAnalyzeData = Extract<
  AiSuggestionRuntimeJob,
  { name: typeof AiSuggestionJobName.ANALYZE }
>["data"];

const AI_SUGGESTION_JOB_RETRY = {
  retryLimit: 2,
  retryDelaySeconds: 5,
  retryBackoff: true,
  expireInSeconds: 10 * 60,
  retentionSeconds: 24 * 60 * 60,
  deleteAfterSeconds: 7 * 24 * 60 * 60,
} as const satisfies JobRetryPolicy;

/**
 * 매시 정각에 사용자 현지 07시대인 사용자를 고른다(리포트 디스패치와 같은 방식).
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
      cron: "0 * * * *",
      timezone: "UTC",
      missed: "once",
      payload: { name: AiSuggestionJobName.DISPATCH, data: {} },
    },
  ],
});
