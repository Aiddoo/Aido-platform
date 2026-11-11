import type { ConfigType } from "@nestjs/config";

import type { appConfig } from "#api/platform/config/app.config";
import type { sentryConfig } from "#api/platform/config/sentry.config";
import { isSentryEnabled } from "#api/platform/config/utils/sentry-options";

const OBSERVABILITY_BACKENDS = ["sentry", "log"] as const;

export type ObservabilityBackend = (typeof OBSERVABILITY_BACKENDS)[number];

export interface ObservabilitySettings {
  readonly app: Pick<ConfigType<typeof appConfig>, "isProduction">;
  readonly sentry: Pick<ConfigType<typeof sentryConfig>, "dsn">;
}

/**
 * 경보·예외 보고·작업 heartbeat 어댑터를 고르는 한 곳. 운영(APP_ENV)에 DSN이 있으면 Sentry,
 * 그 밖(개발·스테이징·테스트, DSN 없음)은 콘솔 로그다. instrument.ts의 SDK enabled와 같은 판정이다.
 */
export function selectObservabilityBackend(settings: ObservabilitySettings): ObservabilityBackend {
  return isSentryEnabled({ isProduction: settings.app.isProduction, dsn: settings.sentry.dsn })
    ? "sentry"
    : "log";
}
