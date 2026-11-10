import { readFileSync } from "node:fs";
import { findPackageJSON } from "node:module";

import * as Sentry from "@sentry/nestjs";

import { processEnv } from "./platform/config/env.js";
import {
  resolveSentryOptions,
  sentryIntegrations,
  toSentryRelease,
} from "./platform/config/utils/sentry-options.js";

const options = resolveSentryOptions(processEnv);
// 운영 이미지는 dist에서 node로 바로 돌아 npm_package_version이 없으므로 가장 가까운 package.json을 읽는다
const packageJsonPath = findPackageJSON(import.meta.url);
const release =
  packageJsonPath == null
    ? undefined
    : toSentryRelease(JSON.parse(readFileSync(packageJsonPath, "utf8")));

Sentry.init({
  dsn: processEnv.SENTRY_DSN,
  // production(APP_ENV 기준)에서만 발송 — 개발서버/스테이징/로컬은 무발송.
  // enabled: false면 SDK가 transport를 만들지 않아 capture가 전부 no-op이다.
  enabled: options.enabled,
  environment: options.environment,
  release,
  tracesSampleRate: options.tracesSampleRate,
  // 추적 헤더는 우리 서비스에만 전파한다 (외부 API가 baggage를 거부하는 사례 방지)
  tracePropagationTargets: [...options.tracePropagationTargets],
  integrations: sentryIntegrations(),

  beforeSend(event) {
    if (event.request?.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
      delete event.request.headers["x-forwarded-for"];
      delete event.request.headers["x-real-ip"];
    }
    if (event.user) {
      delete event.user.ip_address;
    }

    if (event.request?.query_string) {
      event.request.query_string = String(event.request.query_string).replace(
        /token=[^&]+/gi,
        "token=[FILTERED]",
      );
    }

    return event;
  },
});
