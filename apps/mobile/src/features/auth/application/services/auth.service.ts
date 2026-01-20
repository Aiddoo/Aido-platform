/**
 * Auth Service (Application Layer)
 *
 * 비즈니스 로직을 조율하는 애플리케이션 서비스입니다.
 * Repository와 TokenStore를 조합하여 실제 사용 사례를 구현합니다.
 */

import { TokenStore } from '@src/shared/storage/token-store';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { AuthTokens, CurrentUser } from '../../domain/models/user.model';
import type { AuthRepository } from '../../domain/repositories/auth.repository';

export class AuthService {
  constructor(private readonly repository: AuthRepository) {}

  /**
   * OAuth 인증 코드를 교환하고 토큰을 저장합니다.
   *
   * @param code - OAuth 인증 코드
   * @returns 교환된 인증 토큰
   */
  async exchangeCodeAndSaveTokens(code: string): Promise<AuthTokens> {
    const tokens = await this.repository.exchangeCode({ code });
    await TokenStore.setTokens(tokens.accessToken, tokens.refreshToken);
    return tokens;
  }

  /**
   * 현재 인증된 사용자 정보를 조회합니다.
   *
   * @returns 현재 사용자 정보
   */
  async getCurrentUser(): Promise<CurrentUser> {
    return await this.repository.getCurrentUser();
  }

  /**
   * 현재 디바이스에서 로그아웃합니다.
   * API 호출 실패 시에도 로컬 토큰은 반드시 삭제합니다.
   */
  async logout(): Promise<void> {
    try {
      await this.repository.logout();
    } catch {
      // API 로그아웃 실패 시에도 로컬 토큰은 삭제
      // 추후 에러 핸들링 개선 필요
    } finally {
      await TokenStore.clearTokens();
    }
  }

  /**
   * 카카오 OAuth 로그인 플로우를 시작합니다.
   * WebBrowser를 열어 인증을 진행하고 인증 코드를 반환합니다.
   *
   * @returns 인증 코드 (성공 시) 또는 null (실패/취소 시)
   */
  async openKakaoLogin(): Promise<string | null> {
    const redirectUri = Linking.createURL('auth/kakao');
    const authUrl = this.repository.getKakaoAuthUrl(redirectUri);

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    if (result.type === 'success' && result.url) {
      const parsed = Linking.parse(result.url);
      return (parsed.queryParams?.code as string) ?? null;
    }

    return null;
  }
}
