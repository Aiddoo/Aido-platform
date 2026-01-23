import {
  type AuthTokens,
  authTokensSchema,
  type CurrentUser,
  currentUserSchema,
  type ExchangeCodeInput,
} from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import type { Storage } from '@src/core/ports/storage';
import { ENV } from '@src/shared/config/env';
import type { AuthRepository } from './auth.repository';

export class AuthRepositoryImpl implements AuthRepository {
  constructor(
    private readonly _publicHttpClient: HttpClient,
    private readonly _authHttpClient: HttpClient,
    private readonly _storage: Storage,
  ) {}

  async exchangeCode(request: ExchangeCodeInput): Promise<AuthTokens> {
    const { data } = await this._publicHttpClient.post<AuthTokens>('v1/auth/exchange', request);

    const result = authTokensSchema.safeParse(data);
    if (!result.success) {
      console.error('[AuthRepository] Invalid exchangeCode response:', result.error);
      throw new Error('Invalid API response format');
    }

    await Promise.all([
      this._storage.set('accessToken', result.data.accessToken),
      this._storage.set('refreshToken', result.data.refreshToken),
    ]);

    return result.data;
  }

  async getCurrentUser(): Promise<CurrentUser> {
    const { data } = await this._authHttpClient.get<CurrentUser>('v1/auth/me');

    const result = currentUserSchema.safeParse(data);

    if (!result.success) {
      console.error('[AuthRepository] Invalid getCurrentUser response:', result.error);
      throw new Error('Invalid API response format');
    }

    return result.data;
  }

  async logout(): Promise<void> {
    // API 호출을 먼저 실행한 후 토큰 삭제 (순서 중요)
    await this._authHttpClient.post('v1/auth/logout');
    await Promise.all([this._storage.remove('accessToken'), this._storage.remove('refreshToken')]);
  }

  getKakaoAuthUrl(redirectUri: string): string {
    return `${ENV.API_URL}/v1/auth/kakao/start?redirect_uri=${encodeURIComponent(redirectUri)}`;
  }
}
