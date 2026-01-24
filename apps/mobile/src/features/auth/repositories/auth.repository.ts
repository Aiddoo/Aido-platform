import type { AuthTokens, CurrentUser, ExchangeCodeInput } from '@aido/validators';

export interface AuthRepository {
  exchangeCode(request: ExchangeCodeInput): Promise<AuthTokens>;

  getCurrentUser(): Promise<CurrentUser>;

  logout(): Promise<void>;

  getKakaoAuthUrl(redirectUri: string): string;

  getNaverAuthUrl(redirectUri: string): string;
}
