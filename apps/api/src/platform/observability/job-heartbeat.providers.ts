import type { FactoryProvider } from "@nestjs/common";

import { TypedConfigService } from "#api/platform/config/services/config.service";
import type { AppEnvironment } from "#api/platform/config/utils/sentry-options";
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
  inject: [TypedConfigService, jobHeartbeatConfig.KEY],
  useFactory: (config: TypedConfigService, heartbeat: JobHeartbeatConfig) =>
    createJobHeartbeat({
      environment: config.appEnv,
      hasDsn: (config.sentryDsn ?? "") !== "",
      monitorSlug: heartbeat.monitorSlug,
    }),
};
