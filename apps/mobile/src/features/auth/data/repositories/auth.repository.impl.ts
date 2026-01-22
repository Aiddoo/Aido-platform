import type { HttpClient } from '@src/shared/api/http-client';
import type { ApiResponse } from '@src/shared/api/types';
import { ENV } from '@src/shared/config/env';
import type { AuthTokens, CurrentUser, ExchangeCodeInput } from '../../domain/models/user.model';
import { authTokensSchema, currentUserSchema } from '../../domain/models/user.model';
import type { AuthRepository } from '../../domain/repositories/auth.repository';

export class AuthRepositoryImpl implements AuthRepository {
  constructor(private readonly httpClient: HttpClient) {}

  async exchangeCode(request: ExchangeCodeInput): Promise<AuthTokens> {
    const response = await this.httpClient.post<ApiResponse<AuthTokens>>(
      'v1/auth/exchange',
      request,
    );

    const result = authTokensSchema.safeParse(response.data.data);
    if (!result.success) {
      console.error('[AuthRepository] Invalid exchangeCode response:', result.error);
      throw new Error('Invalid API response format');
    }

    return result.data;
  }

  async getCurrentUser(): Promise<CurrentUser> {
    const response = await this.httpClient.get<ApiResponse<CurrentUser>>('v1/auth/me');

    const result = currentUserSchema.safeParse(response.data.data);
    if (!result.success) {
      console.error('[AuthRepository] Invalid getCurrentUser response:', result.error);
      throw new Error('Invalid API response format');
    }

    return result.data;
  }

  async logout(): Promise<void> {
    await this.httpClient.post('v1/auth/logout');
  }

  getKakaoAuthUrl(redirectUri: string): string {
    return `${ENV.API_URL}/v1/auth/kakao/start?redirect_uri=${encodeURIComponent(redirectUri)}`;
  }
}
