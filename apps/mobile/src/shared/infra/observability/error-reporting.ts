import * as Sentry from '@sentry/react-native';
import { ENV } from '@src/shared/config/env';
import type { ComponentType } from 'react';

import { scrubBreadcrumb, scrubSentryEvent } from './scrub-sentry-event';

/**
 * Sentry 초기화. 앱 루트와 위젯 헤드리스 진입점이 각자 부르므로 이미 초기화됐으면 건너뛴다.
 *
 * 부트스트랩 관심사이므로 포트로 추상화하지 않는다(콜사이트 의존성이 아님).
 * 실제 에러/이벤트 리포팅은 `ErrorReporter` 포트(Sentry 어댑터)를 통해 이루어진다.
 *
 * - `enabled`: 프로덕션이면 항상, dev/preview는 `EXPO_PUBLIC_SENTRY_DEBUG=true`일 때만 전송.
 * - Session Replay: 개인정보/투두 노출 방지를 위해 텍스트·이미지·벡터를 전부 마스킹.
 */
export function initErrorReporting(): void {
  if (Sentry.getClient() != null) {
    return;
  }

  Sentry.init({
    dsn: ENV.SENTRY_DSN,
    enabled: ENV.SENTRY_ENABLED,
    environment: ENV.APP_ENV,

    // IP/쿠키 등 기본 PII 전송 비활성. 사용자 식별은 ErrorReporter.setUserId로 명시 연결.
    sendDefaultPii: false,

    // 메모 본문·음성 글자·토큰·이메일이 어디로 들어와도 나가기 직전에 한 번 더 지운다.
    beforeSend: scrubSentryEvent,
    beforeBreadcrumb: scrubBreadcrumb,

    // Session Replay (에러 발생 세션 위주로 수집)
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
