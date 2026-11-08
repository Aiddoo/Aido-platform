import type { SessionExpiredReason } from '@src/core/observability/telemetry-event';

import { type OAuthProviderSlug } from '../domains/oauth.model';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    auth_login: { method: 'email' | OAuthProviderSlug };
    auth_signup: { method: 'email' | OAuthProviderSlug };
    auth_logout: undefined;
    auth_social_linked: { provider: OAuthProviderSlug };
    auth_social_unlinked: { provider: OAuthProviderSlug };
    auth_account_deleted: undefined;
    session_expired: { reason: SessionExpiredReason };
  }
}
