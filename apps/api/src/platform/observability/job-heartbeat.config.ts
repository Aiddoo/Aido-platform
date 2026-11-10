import type { ConfigType } from "@nestjs/config";
import { z } from "zod";

import { defineConfig } from "#api/platform/config/define-config";

const DEFAULT_JOB_MONITOR_SLUG = "aido-job-worker";

const jobHeartbeatSchema = z
  .object({
    // Sentry Crons 모니터 slug(소문자·숫자·-·_, 50자 이하). 비우면 기본값을 쓴다
    SENTRY_JOB_MONITOR_SLUG: z
      .string()
      .trim()
      .max(50)
      .regex(/^[a-z0-9_-]*$/)
      .optional(),
  })
  .transform((env) => ({
    monitorSlug:
      env.SENTRY_JOB_MONITOR_SLUG == null || env.SENTRY_JOB_MONITOR_SLUG === ""
        ? DEFAULT_JOB_MONITOR_SLUG
        : env.SENTRY_JOB_MONITOR_SLUG,
  }));

/** 작업 worker 생존 신호를 받을 Sentry Crons 모니터. 운영 계약이 아니라 추가만 하는 선택 설정이다. */
export const jobHeartbeatConfig = defineConfig("jobHeartbeat", jobHeartbeatSchema, (env) => ({
  SENTRY_JOB_MONITOR_SLUG: env.SENTRY_JOB_MONITOR_SLUG,
}));

export type JobHeartbeatConfig = ConfigType<typeof jobHeartbeatConfig>;
