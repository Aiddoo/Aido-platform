import * as Sentry from '@sentry/react-native';
import { ENV } from '@src/shared/config/env';
import type { ComponentType } from 'react';

import { scrubBreadcrumb, scrubSentryEvent } from './scrub-sentry-event';

/** 앱 루트와 위젯 헤드리스 진입점이 각자 부르므로 이미 초기화됐으면 건너뛴다. Session Replay는 개인정보 노출 방지를 위해 전부 마스킹한다 */
export function initErrorReporting(): void {
  if (Sentry.getClient() != null) {
    return;
  }

  Sentry.init({
    dsn: ENV.SENTRY_DSN,
    enabled: ENV.SENTRY_ENABLED,
    environment: ENV.APP_ENV,

    // 기본 PII 전송 비활성. 사용자 식별은 ErrorReporter.setUserId로 연결한다
    sendDefaultPii: false,

    // 메모 본문·음성 글자·토큰·이메일이 어디로 들어와도 나가기 직전에 한 번 더 지운다.
    beforeSend: scrubSentryEvent,
    beforeBreadcrumb: scrubBreadcrumb,

    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,
    integrations: [
      Sentry.mobileReplayIntegration({
        maskAllText: true,
        maskAllImages: true,
        maskAllVectors: true,
      }),
    ],
  });
}

export function wrapRootComponent<Props extends Record<string, unknown>>(
  RootComponent: ComponentType<Props>,
): ComponentType<Props> {
  return Sentry.wrap(RootComponent);
}
