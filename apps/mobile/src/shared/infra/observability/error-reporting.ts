import * as Sentry from '@sentry/react-native';
import { ENV } from '@src/shared/config/env';
import type { ComponentType } from 'react';

import { scrubBreadcrumb, scrubSentryEvent } from './scrub-sentry-event';
import { toTracePropagationTargets } from './trace-propagation-targets';

// 무료 할당 월 50개 ÷ 30일 오류 약 200건(조직 전체) = 0.25. 오류가 늘어도 할당 안에 들게 0.2로 둔다
const REPLAY_ON_ERROR_SAMPLE_RATE = 0.2;

/** 앱 루트와 위젯 헤드리스 진입점이 각자 부르므로 이미 초기화됐으면 건너뛴다. Session Replay는 개인정보 노출 방지를 위해 전부 마스킹한다 */
export function initErrorReporting(): void {
  if (Sentry.getClient() != null) {
    return;
  }

  Sentry.init({
    dsn: ENV.SENTRY_DSN,
    enabled: ENV.SENTRY_ENABLED,
    environment: ENV.APP_ENV,

    // RN SDK 8은 dataCollection을 받지 않고 이 값으로 IP 추론·라우트 URL·딥링크 수집을 가른다. 사용자는 ErrorReporter.setUserId의 id만 싣는다
    sendDefaultPii: false,

    // 메모 본문·음성 글자·토큰·이메일이 어디로 들어와도 나가기 직전에 한 번 더 지운다.
    beforeSend: scrubSentryEvent,
    beforeBreadcrumb: scrubBreadcrumb,

    // tracesSampleRate 없이 헤더만 이어 앱 span 할당을 쓰지 않고, 표본 여부는 서버가 정한다
    tracePropagationTargets: toTracePropagationTargets(ENV.API_URL),

    // 상시 녹화는 무료 할당을 넘겨 버려졌다(30일 541개). 오류 직전 버퍼만 보낸다
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: REPLAY_ON_ERROR_SAMPLE_RATE,
    integrations: [
      Sentry.reactNativeTracingIntegration(),
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
