import { t } from '@src/shared/i18n';

import { type OAuthProvider } from '../domains/oauth.model';

const OAUTH_PROVIDER_LABEL_KEYS = {
  APPLE: 'auth:providers.APPLE',
  GOOGLE: 'auth:providers.GOOGLE',
  KAKAO: 'auth:providers.KAKAO',
  NAVER: 'auth:providers.NAVER',
} as const satisfies Record<OAuthProvider, string>;

export function getOAuthProviderLabel(provider: OAuthProvider): string {
  return t(OAUTH_PROVIDER_LABEL_KEYS[provider]);
}
