import {
  type AppleMobileCallbackInput,
  type AuthTokens as AuthTokensDTO,
  authTokensSchema as authTokensDtoSchema,
  type ConsentResponse,
  type CurrentUser,
  consentResponseSchema,
  currentUserSchema,
  type ExchangeCodeInput,
  type LinkedAccountsResponse,
  linkedAccountsResponseSchema,
  type PreferenceResponse,
  preferenceResponseSchema,
  type RegisterInput,
  type RegisterResponse,
  type ResendVerificationInput,
  type ResendVerificationResponse,
  registerResponseSchema,
  resendVerificationResponseSchema,
  type UpdateMarketingConsentInput,
  type UpdateMarketingConsentResponse,
  type UpdatePreferenceInput,
  updateMarketingConsentResponseSchema,
  updatePreferenceResponseSchema,
  type VerifyEmailInput,
} from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import { ENV } from '@src/shared/config/env';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';
import { Platform } from 'react-native';

import type {
  AuthTokens,
  Consent,
  LinkedAccount,
  OAuthProvider,
  OAuthStartMode,
  OAuthStartProvider,
  Preference,
  RegisterResult,
  ResendVerificationResult,
  UpdateMarketingConsentResult,
  User,
} from '../models/auth.model';
import {
  toAuthTokens,
  toConsent,
  toLinkedAccounts,
  toPreference,
  toRegisterResult,
  toResendVerificationResult,
  toUpdateMarketingConsentResult,
  toUser,
} from './auth.mapper';
import type { AuthRepository } from './auth.repository';

export class AuthRepositoryImpl implements AuthRepository {
  readonly #publicHttpClient: HttpClient;
  readonly #authHttpClient: HttpClient;

  constructor(publicHttpClient: HttpClient, authHttpClient: HttpClient) {
    this.#publicHttpClient = publicHttpClient;
    this.#authHttpClient = authHttpClient;
  }

  async exchangeCode(request: ExchangeCodeInput): Promise<Result<AuthTokens, ApiError>> {
    const result = await this.#publicHttpClient.post<AuthTokensDTO>('v1/auth/exchange', request);

    if (!result.ok) return result;

    const parsed = authTokensDtoSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[AuthRepository] Invalid exchangeCode response:', parsed.error);
      throw new ParseError();
    }

    return ok(toAuthTokens(parsed.data));
  }

  async emailLogin(email: string, password: string): Promise<Result<AuthTokens, ApiError>> {
    const result = await this.#publicHttpClient.post<AuthTokensDTO>('v1/auth/login', {
      email,
      password,
      deviceType: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
    });

    if (!result.ok) return result;

    const parsed = authTokensDtoSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[AuthRepository] Invalid emailLogin response:', parsed.error);
      throw new ParseError();
    }

    return ok(toAuthTokens(parsed.data));
  }

  async appleLogin(input: AppleMobileCallbackInput): Promise<Result<AuthTokens, ApiError>> {
    const result = await this.#publicHttpClient.post<AuthTokensDTO>(
      'v1/auth/apple/callback',
      input,
    );

    if (!result.ok) return result;

    const parsed = authTokensDtoSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[AuthRepository] Invalid appleLogin response:', parsed.error);
      throw new ParseError();
    }

    return ok(toAuthTokens(parsed.data));
  }

  async getCurrentUser(): Promise<Result<User, ApiError>> {
    const result = await this.#authHttpClient.get<CurrentUser>('v1/auth/me');

    if (!result.ok) return result;

    const parsed = currentUserSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[AuthRepository] Invalid getCurrentUser response:', parsed.error);
      throw new ParseError();
    }

    return ok(toUser(parsed.data));
  }

  async logout(): Promise<Result<void, ApiError>> {
    const result = await this.#authHttpClient.post('v1/auth/logout');

    if (!result.ok) return result;

    return ok(undefined);
  }

  getOAuthWebStartUrl(
    provider: OAuthStartProvider,
    redirectUri: string,
    mode: OAuthStartMode,
  ): string {
    const authPathByProvider: Record<OAuthStartProvider, string> = {
      kakao: 'kakao',
      naver: 'naver',
      google: 'google',
    };

    const params = new URLSearchParams({
      redirect_uri: redirectUri,
      mode,
    });

    return `${ENV.API_URL}/v1/auth/${authPathByProvider[provider]}/start?${params.toString()}`;
  }

  async getPreference(): Promise<Result<Preference, ApiError>> {
    const result = await this.#authHttpClient.get<PreferenceResponse>('v1/auth/preference');

    if (!result.ok) return result;

    const parsed = preferenceResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[AuthRepository] Invalid getPreference response:', parsed.error);
      throw new ParseError();
    }

    return ok(toPreference(parsed.data));
  }

  async updatePreference(input: UpdatePreferenceInput): Promise<Result<Preference, ApiError>> {
    const result = await this.#authHttpClient.patch<PreferenceResponse>(
      'v1/auth/preference',
      input,
    );

    if (!result.ok) return result;

    const parsed = updatePreferenceResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[AuthRepository] Invalid updatePreference response:', parsed.error);
      throw new ParseError();
    }

    return ok(toPreference(parsed.data));
  }

  async getConsent(): Promise<Result<Consent, ApiError>> {
    const result = await this.#authHttpClient.get<ConsentResponse>('v1/auth/consent');

    if (!result.ok) return result;

    const parsed = consentResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[AuthRepository] Invalid getConsent response:', parsed.error);
      throw new ParseError();
    }

    return ok(toConsent(parsed.data));
  }

  async updateMarketingConsent(
    input: UpdateMarketingConsentInput,
  ): Promise<Result<UpdateMarketingConsentResult, ApiError>> {
    const result = await this.#authHttpClient.patch<UpdateMarketingConsentResponse>(
      'v1/auth/consent/marketing',
      input,
    );

    if (!result.ok) return result;

    const parsed = updateMarketingConsentResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[AuthRepository] Invalid updateMarketingConsent response:', parsed.error);
      throw new ParseError();
    }

    return ok(toUpdateMarketingConsentResult(parsed.data));
  }

  async register(input: RegisterInput): Promise<Result<RegisterResult, ApiError>> {
    const result = await this.#publicHttpClient.post<RegisterResponse>('v1/auth/register', input);

    if (!result.ok) return result;

    const parsed = registerResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[AuthRepository] Invalid register response:', parsed.error);
      throw new ParseError();
    }

    return ok(toRegisterResult(parsed.data));
  }

  async verifyEmail(input: VerifyEmailInput): Promise<Result<AuthTokens, ApiError>> {
    const result = await this.#publicHttpClient.post<AuthTokensDTO>('v1/auth/verify-email', input);

    if (!result.ok) return result;

    const parsed = authTokensDtoSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[AuthRepository] Invalid verifyEmail response:', parsed.error);
      throw new ParseError();
    }

    return ok(toAuthTokens(parsed.data));
  }

  async resendVerification(
    input: ResendVerificationInput,
  ): Promise<Result<ResendVerificationResult, ApiError>> {
    const result = await this.#publicHttpClient.post<ResendVerificationResponse>(
      'v1/auth/resend-verification',
      input,
    );

    if (!result.ok) return result;

    const parsed = resendVerificationResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[AuthRepository] Invalid resendVerification response:', parsed.error);
      throw new ParseError();
    }

    return ok(toResendVerificationResult(parsed.data));
  }

  async getLinkedAccounts(): Promise<Result<LinkedAccount[], ApiError>> {
    const result =
      await this.#authHttpClient.get<LinkedAccountsResponse>('v1/auth/linked-accounts');

    if (!result.ok) return result;

    const parsed = linkedAccountsResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[AuthRepository] Invalid getLinkedAccounts response:', parsed.error);
      throw new ParseError();
    }

    return ok(toLinkedAccounts(parsed.data));
  }

  async linkWithCode(code: string): Promise<Result<{ message: string }, ApiError>> {
    return this.#authHttpClient.post('v1/auth/link-with-code', { code });
  }

  async linkApple(idToken: string): Promise<Result<{ message: string }, ApiError>> {
    return this.#authHttpClient.post('v1/auth/link', { provider: 'APPLE', idToken });
  }

  async unlinkAccount(provider: OAuthProvider): Promise<Result<{ message: string }, ApiError>> {
    return this.#authHttpClient.delete(`v1/auth/linked-accounts/${provider}`);
  }
}
