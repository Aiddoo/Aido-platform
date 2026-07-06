import * as Sentry from '@sentry/react-native';
import { ENV } from '@src/shared/config/env';

/**
 * Sentry 초기화(앱 루트에서 1회).
 *
 * 부트스트랩 관심사이므로 포트로 추상화하지 않는다(콜사이트 의존성이 아님).
 * 실제 에러/이벤트 리포팅은 `ErrorReporter` 포트(Sentry 어댑터)를 통해 이루어진다.
 *
 * - `enabled`: 프로덕션이면 항상, dev/preview는 `EXPO_PUBLIC_SENTRY_DEBUG=true`일 때만 전송.
 * - Session Replay: 개인정보/투두 노출 방지를 위해 텍스트·이미지·벡터를 전부 마스킹.
 */
export const initSentry = (): void => {
  Sentry.init({
    dsn: ENV.SENTRY_DSN,
    enabled: ENV.SENTRY_ENABLED,
    environment: ENV.APP_ENV,

    // IP/쿠키 등 기본 PII 전송 비활성. 사용자 식별은 ErrorReporter.setUserId로 명시 연결.
    sendDefaultPii: false,

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
};
