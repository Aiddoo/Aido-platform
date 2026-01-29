import {
  type AppleMobileCallbackInput,
  type AuthTokens,
  authTokensSchema,
  type CurrentUser,
  consentResponseSchema,
  currentUserSchema,
  type ExchangeCodeInput,
  preferenceResponseSchema,
  type UpdateMarketingConsentInput,
  type UpdatePreferenceInput,
  updateMarketingConsentResponseSchema,
  updatePreferenceResponseSchema,
} from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import type { Storage } from '@src/core/ports/storage';
import { ENV } from '@src/shared/config/env';
import { AuthClientError } from '../models/auth.error';
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
      throw AuthClientError.validation();
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
      throw AuthClientError.validation();
    }

    return result.data;
  }

  async logout(): Promise<void> {
    await this._authHttpClient.post('v1/auth/logout');
    await Promise.all([this._storage.remove('accessToken'), this._storage.remove('refreshToken')]);
  }

  getKakaoAuthUrl(redirectUri: string): string {
    return `${ENV.API_URL}/v1/auth/kakao/start?redirect_uri=${encodeURIComponent(redirectUri)}`;
  }

  getNaverAuthUrl(redirectUri: string): string {
    return `${ENV.API_URL}/v1/auth/naver/start?redirect_uri=${encodeURIComponent(redirectUri)}`;
  }

  getGoogleAuthUrl(redirectUri: string): string {
    return `${ENV.API_URL}/v1/auth/google/start?redirect_uri=${encodeURIComponent(redirectUri)}`;
  }

  async getPreference() {
    const { data } = await this._authHttpClient.get('v1/auth/preference');

    const result = preferenceResponseSchema.safeParse(data);
    if (!result.success) {
      console.error('[AuthRepository] Invalid getPreference response:', result.error);
      throw AuthClientError.validation();
    }

    return result.data;
  }

  async updatePreference(input: UpdatePreferenceInput) {
    const { data } = await this._authHttpClient.patch('v1/auth/preference', input);

    const result = updatePreferenceResponseSchema.safeParse(data);
    if (!result.success) {
      console.error('[AuthRepository] Invalid updatePreference response:', result.error);
      throw AuthClientError.validation();
    }

    return result.data;
  }

  async getConsent() {
    const { data } = await this._authHttpClient.get('v1/auth/consent');

    const result = consentResponseSchema.safeParse(data);
    if (!result.success) {
      console.error('[AuthRepository] Invalid getConsent response:', result.error);
      throw AuthClientError.validation();
    }

    return result.data;
  }

  async updateMarketingConsent(input: UpdateMarketingConsentInput) {
    const { data } = await this._authHttpClient.patch('v1/auth/consent/marketing', input);

    const result = updateMarketingConsentResponseSchema.safeParse(data);
    if (!result.success) {
      console.error('[AuthRepository] Invalid updateMarketingConsent response:', result.error);
      throw AuthClientError.validation();
    }

    return result.data;
  }

  async appleLogin(input: AppleMobileCallbackInput): Promise<AuthTokens> {
    const { data } = await this._publicHttpClient.post<AuthTokens>('v1/auth/apple/callback', input);

    const result = authTokensSchema.safeParse(data);
    if (!result.success) {
      console.error('[AuthRepository] Invalid appleLogin response:', result.error);
      throw AuthClientError.validation();
    }

    await Promise.all([
      this._storage.set('accessToken', result.data.accessToken),
      this._storage.set('refreshToken', result.data.refreshToken),
    ]);

    return result.data;
  }
}
