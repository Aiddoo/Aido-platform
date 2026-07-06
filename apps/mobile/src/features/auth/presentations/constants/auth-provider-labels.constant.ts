import { t } from '@src/shared/i18n';
import type { OAuthProvider } from '../../models/oauth.model';

export const OAUTH_PROVIDER_LABEL_KEYS = {
  APPLE: 'auth:providers.APPLE',
  GOOGLE: 'auth:providers.GOOGLE',
  KAKAO: 'auth:providers.KAKAO',
  NAVER: 'auth:providers.NAVER',
} as const satisfies Record<OAuthProvider, string>;

/** OAuth 제공자 → 로케일 표시 이름 */
export const getOAuthProviderLabel = (provider: OAuthProvider): string =>
  t(OAUTH_PROVIDER_LABEL_KEYS[provider]);
