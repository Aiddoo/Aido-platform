import { type OAuthProvider } from '../domains/oauth.model';

const OAUTH_PROVIDER_LABEL_KEYS = {
  APPLE: 'auth:providers.APPLE',
  GOOGLE: 'auth:providers.GOOGLE',
  KAKAO: 'auth:providers.KAKAO',
  NAVER: 'auth:providers.NAVER',
} as const satisfies Record<OAuthProvider, string>;

/** 공급자 이름 문구 키. 로그인 버튼·연결 계정·연결 토스트가 같은 이름을 쓴다 */
export function getOAuthProviderLabelKey(provider: OAuthProvider) {
  return OAUTH_PROVIDER_LABEL_KEYS[provider];
}
