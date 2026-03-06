export type AuthMethod = 'email' | 'google' | 'apple' | 'kakao' | 'naver';
export type SocialProvider = 'google' | 'apple' | 'kakao' | 'naver';

export interface AuthEventMap {
  auth_login: { method: AuthMethod };
  auth_signup: { method: AuthMethod };
  auth_logout: undefined;
  auth_social_linked: { provider: SocialProvider };
  auth_social_unlinked: { provider: SocialProvider };
  auth_account_deleted: undefined;
}
