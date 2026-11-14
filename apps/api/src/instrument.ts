import * as Sentry from "@sentry/nestjs";

import { processEnv } from "./platform/config/env.js";
import {
  beforeSendError,
  resolveSentryOptions,
  SENTRY_DATA_COLLECTION,
  sentryIntegrations,
} from "./platform/config/utils/sentry-options.js";

const options = resolveSentryOptions(processEnv);
Sentry.init({
  dsn: processEnv.SENTRY_DSN,
  // production(APP_ENV 기준)에 DSN이 있을 때만 발송한다. 그 밖에는 AlertingModule이 로그 어댑터를 고른다.
  // enabled: false면 SDK가 transport를 만들지 않아 capture가 전부 no-op이다.
  enabled: options.enabled,
  environment: options.environment,
  // release는 SDK가 SENTRY_RELEASE에서 읽는다. 이미지 빌드가 커밋 SHA로 넣는다(Dockerfile)
  tracesSampler: options.tracesSampler,
  // 추적 헤더는 우리 서비스에만 전파한다 (외부 API가 baggage를 거부하는 사례 방지)
  tracePropagationTargets: [...options.tracePropagationTargets],
  integrations: sentryIntegrations(),
  dataCollection: SENTRY_DATA_COLLECTION,
  beforeSend: beforeSendError,
});
