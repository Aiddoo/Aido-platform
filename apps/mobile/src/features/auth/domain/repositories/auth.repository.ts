/**
 * Auth Repository Interface
 *
 * DIP(Dependency Inversion Principle)를 적용하여
 * Domain 레이어에서 인터페이스를 정의하고,
 * Data 레이어에서 구현합니다.
 */

import type { AuthTokens, CurrentUser, ExchangeCodeInput } from '../models/user.model';

export interface AuthRepository {
  /**
   * OAuth 인증 코드를 액세스 토큰으로 교환합니다.
   */
  exchangeCode(request: ExchangeCodeInput): Promise<AuthTokens>;

  /**
   * 현재 인증된 사용자 정보를 조회합니다.
   */
  getCurrentUser(): Promise<CurrentUser>;

  /**
   * 현재 디바이스에서 로그아웃합니다.
   */
  logout(): Promise<void>;

  /**
   * 카카오 OAuth 인증 URL을 생성합니다.
   */
  getKakaoAuthUrl(redirectUri: string): string;
}
