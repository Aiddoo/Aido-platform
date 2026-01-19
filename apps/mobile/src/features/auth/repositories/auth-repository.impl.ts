import {
  type AuthTokens,
  authTokensSchema,
  type CurrentUser,
  currentUserSchema,
  type ExchangeCodeInput,
} from '@aido/validators';
import type { HttpClient } from '@src/core/api';
import type { ExchangeCodeResponseDto, GetCurrentUserResponseDto } from './auth.dto';
import type { AuthRepository } from './auth.repository';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

export class AuthRepositoryImpl implements AuthRepository {
  constructor(private readonly httpClient: HttpClient) {}

  async exchangeCode(request: ExchangeCodeInput): Promise<AuthTokens> {
    const response = await this.httpClient.post<ExchangeCodeResponseDto>(
      'v1/auth/exchange',
      request,
    );

    const result = authTokensSchema.safeParse(response.data.data);
    if (!result.success) {
      console.error('Invalid exchangeCode response:', result.error);
      throw new Error('Invalid response');
    }

    return result.data;
  }

  async getCurrentUser(): Promise<CurrentUser> {
    const response = await this.httpClient.get<GetCurrentUserResponseDto>('v1/auth/me');

    const result = currentUserSchema.safeParse(response.data.data);
    if (!result.success) {
      console.error('Invalid getCurrentUser response:', result.error);
      throw new Error('Invalid response');
    }

    return result.data;
  }

  async logout(): Promise<void> {
    await this.httpClient.post('v1/auth/logout');
  }

  getKakaoAuthUrl(redirectUri: string): string {
    return `${API_URL}/v1/auth/kakao/start?redirect_uri=${encodeURIComponent(redirectUri)}`;
  }
}
