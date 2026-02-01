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
import { Platform } from 'react-native';
import { AuthValidationError } from '../models/auth.error';
import type { AuthRepository } from './auth.repository';

export class AuthRepositoryImpl implements AuthRepository {
  readonly #publicHttpClient: HttpClient;
  readonly #authHttpClient: HttpClient;
  readonly #storage: Storage;

  constructor(publicHttpClient: HttpClient, authHttpClient: HttpClient, storage: Storage) {
    this.#publicHttpClient = publicHttpClient;
    this.#authHttpClient = authHttpClient;
    this.#storage = storage;
  }

  async exchangeCode(request: ExchangeCodeInput): Promise<AuthTokens> {
    const { data } = await this.#publicHttpClient.post<AuthTokens>('v1/auth/exchange', request);

    const result = authTokensSchema.safeParse(data);
    if (!result.success) {
      throw new AuthValidationError(result.error, 'v1/auth/exchange');
    }

    await Promise.all([
      this.#storage.set('accessToken', result.data.accessToken),
      this.#storage.set('refreshToken', result.data.refreshToken),
    ]);

    return result.data;
  }

  async emailLogin(email: string, password: string): Promise<AuthTokens> {
    const { data } = await this.#publicHttpClient.post<AuthTokens>('v1/auth/login', {
      email,
      password,
      deviceType: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
    });

    const result = authTokensSchema.safeParse(data);
    if (!result.success) {
      throw new AuthValidationError(result.error, 'v1/auth/login');
    }

    await Promise.all([
      this.#storage.set('accessToken', result.data.accessToken),
      this.#storage.set('refreshToken', result.data.refreshToken),
    ]);

    return result.data;
  }

  async getCurrentUser(): Promise<CurrentUser> {
    const { data } = await this.#authHttpClient.get<CurrentUser>('v1/auth/me');

    const result = currentUserSchema.safeParse(data);
    if (!result.success) {
      throw new AuthValidationError(result.error, 'v1/auth/me');
    }

    return result.data;
  }

  async logout(): Promise<void> {
    await this.#authHttpClient.post('v1/auth/logout');
    await Promise.all([this.#storage.remove('accessToken'), this.#storage.remove('refreshToken')]);
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
    const { data } = await this.#authHttpClient.get('v1/auth/preference');

    const result = preferenceResponseSchema.safeParse(data);
    if (!result.success) {
      throw new AuthValidationError(result.error, 'v1/auth/preference');
    }

    return result.data;
  }

  async updatePreference(input: UpdatePreferenceInput) {
    const { data } = await this.#authHttpClient.patch('v1/auth/preference', input);

    const result = updatePreferenceResponseSchema.safeParse(data);
    if (!result.success) {
      throw new AuthValidationError(result.error, 'v1/auth/preference');
    }

    return result.data;
  }

  async getConsent() {
    const { data } = await this.#authHttpClient.get('v1/auth/consent');

    const result = consentResponseSchema.safeParse(data);
    if (!result.success) {
      throw new AuthValidationError(result.error, 'v1/auth/consent');
    }

    return result.data;
  }

  async updateMarketingConsent(input: UpdateMarketingConsentInput) {
    const { data } = await this.#authHttpClient.patch('v1/auth/consent/marketing', input);

    const result = updateMarketingConsentResponseSchema.safeParse(data);
    if (!result.success) {
      throw new AuthValidationError(result.error, 'v1/auth/consent/marketing');
    }

    return result.data;
  }

  async appleLogin(input: AppleMobileCallbackInput): Promise<AuthTokens> {
    const { data } = await this.#publicHttpClient.post<AuthTokens>('v1/auth/apple/callback', input);

    const result = authTokensSchema.safeParse(data);
    if (!result.success) {
      throw new AuthValidationError(result.error, 'v1/auth/apple/callback');
    }

    await Promise.all([
      this.#storage.set('accessToken', result.data.accessToken),
      this.#storage.set('refreshToken', result.data.refreshToken),
    ]);

    return result.data;
  }
}
