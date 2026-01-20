/**
 * Auth Repository Implementation
 *
 * HttpClient를 사용하여 실제 API 호출을 수행하는 구현체입니다.
 * @aido/validators 스키마를 사용하여 런타임 타입 검증을 수행합니다.
 */

import type { HttpClient } from '@src/shared/api/http-client';
import type { ApiResponse } from '@src/shared/api/types';
import type { AuthTokens, CurrentUser, ExchangeCodeInput } from '../../domain/models/user.model';
import { authTokensSchema, currentUserSchema } from '../../domain/models/user.model';
import type { AuthRepository } from '../../domain/repositories/auth.repository';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

export class AuthRepositoryImpl implements AuthRepository {
  constructor(private readonly httpClient: HttpClient) {}

  /**
   * OAuth 인증 코드를 액세스 토큰으로 교환합니다.
   */
  async exchangeCode(request: ExchangeCodeInput): Promise<AuthTokens> {
    const response = await this.httpClient.post<ApiResponse<AuthTokens>>(
      'v1/auth/exchange',
      request,
    );

    // Zod 스키마로 런타임 검증
    const result = authTokensSchema.safeParse(response.data.data);
    if (!result.success) {
      console.error('[AuthRepository] Invalid exchangeCode response:', result.error);
      throw new Error('Invalid API response format');
    }

    return result.data;
  }

  /**
   * 현재 인증된 사용자 정보를 조회합니다.
   */
  async getCurrentUser(): Promise<CurrentUser> {
    const response = await this.httpClient.get<ApiResponse<CurrentUser>>('v1/auth/me');

    // Zod 스키마로 런타임 검증
    const result = currentUserSchema.safeParse(response.data.data);
    if (!result.success) {
      console.error('[AuthRepository] Invalid getCurrentUser response:', result.error);
      throw new Error('Invalid API response format');
    }

    return result.data;
  }

  /**
   * 현재 디바이스에서 로그아웃합니다.
   */
  async logout(): Promise<void> {
    await this.httpClient.post('v1/auth/logout');
  }

  /**
   * 카카오 OAuth 인증 URL을 생성합니다.
   */
  getKakaoAuthUrl(redirectUri: string): string {
    return `${API_URL}/v1/auth/kakao/start?redirect_uri=${encodeURIComponent(redirectUri)}`;
  }
}
