import type { OAuthProvider, OAuthProviderSlug } from '@src/features/auth/models/auth.model';
import { AUTH_PROVIDER_LABELS } from '../constants/auth-provider-labels.constant';

const OAUTH_PROVIDER_TO_SLUG: Record<OAuthProvider, OAuthProviderSlug> = {
  APPLE: 'apple',
  GOOGLE: 'google',
  KAKAO: 'kakao',
  NAVER: 'naver',
};

export function getOAuthProviderSlugLabel(slug: OAuthProviderSlug): string {
  return AUTH_PROVIDER_LABELS[slug];
}

export function getOAuthProviderLabel(provider: OAuthProvider): string {
  return AUTH_PROVIDER_LABELS[OAUTH_PROVIDER_TO_SLUG[provider]];
}
