import type { SessionExpiredReason } from '@src/core/observability/telemetry-event';

import type { OAuthProviderSlug } from '../schemas/oauth.schema';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    auth_login: { method: 'email' | OAuthProviderSlug };
    auth_signup: { method: 'email' | OAuthProviderSlug };
    auth_logout: undefined;
    auth_social_linked: { provider: OAuthProviderSlug };
    auth_social_unlinked: { provider: OAuthProviderSlug };
    auth_account_deleted: undefined;
    /** 비자발적 로그아웃(토큰 만료·거부·재사용 감지). reason별 severity는 Sentry 쪽에서 판정. */
    session_expired: { reason: SessionExpiredReason };
  }
}

export {};
