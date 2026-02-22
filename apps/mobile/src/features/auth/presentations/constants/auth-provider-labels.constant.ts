import type { OAuthProvider } from '../../models/oauth.model';

export const OAUTH_PROVIDER_LABELS = {
  APPLE: 'Apple',
  GOOGLE: 'Google',
  KAKAO: '카카오',
  NAVER: '네이버',
} as const satisfies Record<OAuthProvider, string>;
