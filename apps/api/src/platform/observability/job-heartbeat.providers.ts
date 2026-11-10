import type { FactoryProvider } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";

import { appConfig } from "#api/platform/config/app.config";
import type { AppEnvironment } from "#api/platform/config/schemas/app.schema";
import { sentryConfig } from "#api/platform/config/sentry.config";
import { JobHeartbeatPort } from "#api/shared/application/ports/job-heartbeat.port";

import { type JobHeartbeatConfig, jobHeartbeatConfig } from "./job-heartbeat.config.js";
import { NoopJobHeartbeatAdapter } from "./noop-job-heartbeat.adapter.js";
import { SentryJobHeartbeatAdapter } from "./sentry-job-heartbeat.adapter.js";

export interface JobHeartbeatTarget {
  readonly environment: AppEnvironment;
  readonly hasDsn: boolean;
  readonly monitorSlug: string;
}

// Sentry SDK가 production에서 DSN이 있을 때만 켜지므로(instrument.ts) 같은 조건에서만 check-in 어댑터를 고른다
export function createJobHeartbeat(target: JobHeartbeatTarget): JobHeartbeatPort {
  return target.environment === "production" && target.hasDsn
    ? new SentryJobHeartbeatAdapter(target.monitorSlug)
    : new NoopJobHeartbeatAdapter();
}

export const jobHeartbeatProvider: FactoryProvider<JobHeartbeatPort> = {
  provide: JobHeartbeatPort,
  inject: [appConfig.KEY, sentryConfig.KEY, jobHeartbeatConfig.KEY],
  useFactory: (
    app: ConfigType<typeof appConfig>,
    sentry: ConfigType<typeof sentryConfig>,
    heartbeat: JobHeartbeatConfig,
  ) =>
    createJobHeartbeat({
      environment: app.environment,
      hasDsn: (sentry.dsn ?? "") !== "",
      monitorSlug: heartbeat.monitorSlug,
    }),
};
