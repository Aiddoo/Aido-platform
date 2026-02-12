import type { AuthProviderSlug, OAuthProvider } from '../../models/auth.model';

export const AUTH_PROVIDER_LABELS = {
  credential: '이메일',
  kakao: '카카오',
  google: 'Google',
  apple: 'Apple',
  naver: '네이버',
} as const satisfies Record<AuthProviderSlug, string>;

export const OAUTH_PROVIDER_LABELS = {
  APPLE: 'Apple',
  GOOGLE: 'Google',
  KAKAO: '카카오',
  NAVER: '네이버',
} as const satisfies Record<OAuthProvider, string>;
