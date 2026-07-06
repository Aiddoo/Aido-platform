import type { SessionExpiredReason } from '@src/core/ports/telemetry-event';

export type AuthMethod = 'email' | 'google' | 'apple' | 'kakao' | 'naver';
export type SocialProvider = 'google' | 'apple' | 'kakao' | 'naver';

export interface AuthEventMap {
  auth_login: { method: AuthMethod };
  auth_signup: { method: AuthMethod };
  auth_logout: undefined;
  auth_social_linked: { provider: SocialProvider };
  auth_social_unlinked: { provider: SocialProvider };
  auth_account_deleted: undefined;
  /** 비자발적 로그아웃(토큰 만료·거부·재사용 감지). reason별 severity는 Sentry 쪽에서 판정. */
  session_expired: { reason: SessionExpiredReason };
}
