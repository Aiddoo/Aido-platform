import {
  type AppleMobileCallbackInput,
  type AuthTokens as AuthTokensDTO,
  authTokensSchema as authTokensDtoSchema,
  type ChangePasswordInput,
  type ChangePasswordResponse,
  type ConsentResponse,
  changePasswordResponseSchema,
  consentResponseSchema,
  type DeleteAccountInput,
  type DeleteAccountResponse,
  deleteAccountResponseSchema,
  type ExchangeCodeInput,
  type ForgotPasswordInput,
  type ForgotPasswordResponse,
  forgotPasswordResponseSchema,
  type LinkedAccountsResponse,
  linkedAccountsResponseSchema,
  type PreferenceResponse,
  preferenceResponseSchema,
  type RegisterInput,
  type RegisterResponse,
  type ResendVerificationInput,
  type ResendVerificationResponse,
  type ResetPasswordInput,
  type ResetPasswordResponse,
  registerResponseSchema,
  resendVerificationResponseSchema,
  resetPasswordResponseSchema,
  type UpdateMarketingConsentInput,
  type UpdateMarketingConsentResponse,
  type UpdatePreferenceInput,
  updateMarketingConsentResponseSchema,
  updatePreferenceResponseSchema,
  type VerifyEmailInput,
} from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import type { Storage } from '@src/core/ports/storage';
import { ENV } from '@src/shared/config/env';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { err, ok, type Result } from '@src/shared/errors/result';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { WebBrowserResultType } from 'expo-web-browser';
import { Platform } from 'react-native';

import { type AuthError, AuthErrors, isAuthError, isExpoCodedError } from '../models/auth.error';
import type {
  AuthTokens,
  ChangePasswordResult,
  Consent,
  DeleteAccountResult,
  ForgotPasswordResult,
  Preference,
  RegisterResult,
  ResendVerificationResult,
  ResetPasswordResult,
  UpdateMarketingConsentResult,
} from '../models/auth.model';
import type {
  LinkedAccountsResult,
  OAuthProvider,
  OAuthProviderSlug,
  OAuthStartMode,
  OAuthStartProvider,
} from '../models/oauth.model';
import {
  toAuthTokens,
  toChangePasswordResult,
  toConsent,
  toDeleteAccountResult,
  toForgotPasswordResult,
  toLinkedAccounts,
  toPreference,
  toRegisterResult,
  toResendVerificationResult,
  toResetPasswordResult,
  toUpdateMarketingConsentResult,
} from './auth.mapper';

const OAUTH_PATHS: Record<OAuthStartProvider, string> = {
  kakao: 'auth/kakao',
  naver: 'auth/naver',
  google: 'auth/google',
};

const AUTH_PATH_BY_PROVIDER: Record<OAuthStartProvider, string> = {
  kakao: 'kakao',
  naver: 'naver',
  google: 'google',
};

export type AuthServiceError = ApiError | AuthError;

export class AuthService {
  readonly #publicHttpClient: HttpClient;
  readonly #authHttpClient: HttpClient;
  readonly #storage: Storage;

  constructor(publicHttpClient: HttpClient, authHttpClient: HttpClient, storage: Storage) {
    this.#publicHttpClient = publicHttpClient;
    this.#authHttpClient = authHttpClient;
    this.#storage = storage;
  }

  #getRedirectUri = (provider: OAuthStartProvider): string =>
    makeRedirectUri({
      scheme: ENV.SCHEME,
      path: OAUTH_PATHS[provider],
    });

  #getOAuthWebStartUrl = (
    provider: OAuthStartProvider,
    redirectUri: string,
    mode: OAuthStartMode,
    userHint?: string,
  ): string => {
    const params = new URLSearchParams({
      redirect_uri: redirectUri,
      mode,
    });

    if (userHint) {
      params.set('user_hint', userHint);
    }

    return `${ENV.API_URL}/v1/auth/${AUTH_PATH_BY_PROVIDER[provider]}/start?${params.toString()}`;
  };

  #extractCodeFromUrl = (url: string): string | null => {
    const parsedUrl = Linking.parse(url);
    const queryParams = parsedUrl.queryParams;
    const codeParam = queryParams?.code;

    const isSingleCode = typeof codeParam === 'string';
    const isMultipleCodes = Array.isArray(codeParam);

    if (isSingleCode) {
      return codeParam;
    }

    if (isMultipleCodes) {
      const firstCode = codeParam[0];
      return firstCode ?? null;
    }

    try {
      const parsedWithUrl = new URL(url);
      const searchCode = parsedWithUrl.searchParams.get('code');
      if (searchCode) {
        return searchCode;
      }

      const hash = parsedWithUrl.hash.startsWith('#')
        ? parsedWithUrl.hash.slice(1)
        : parsedWithUrl.hash;
      if (!hash) {
        return null;
      }

      const hashParams = new URLSearchParams(hash);
      const hashCode = hashParams.get('code');

      if (hashCode) {
        return hashCode;
      }
    } catch {
      return null;
    }

    return null;
  };

  #extractOAuthErrorFromUrl = (url: string): { code?: string; description?: string } => {
    const parsedUrl = Linking.parse(url);
    const queryParams = parsedUrl.queryParams;
    const errorParam = queryParams?.error;
    const descriptionParam = queryParams?.error_description;

    const normalizeQueryParam = (value: unknown): string | undefined => {
      if (typeof value === 'string') {
        return value;
      }
      if (Array.isArray(value)) {
        return typeof value[0] === 'string' ? value[0] : undefined;
      }
      return undefined;
    };

    return {
      code: normalizeQueryParam(errorParam),
      description: normalizeQueryParam(descriptionParam),
    };
  };

  #saveTokens = async (accessToken: string, refreshToken: string): Promise<void> => {
    await Promise.all([
      this.#storage.set('accessToken', accessToken),
      this.#storage.set('refreshToken', refreshToken),
    ]);
  };

  #clearTokens = async (): Promise<void> => {
    await Promise.all([this.#storage.remove('accessToken'), this.#storage.remove('refreshToken')]);
  };

  #parseAuthTokens = (result: { ok: true; value: AuthTokensDTO }): AuthTokens => {
    const parsed = authTokensDtoSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[AuthService] Invalid auth tokens response: ${parsed.error.message}`);
    }
    return toAuthTokens(parsed.data);
  };

  #generateNonce = async (): Promise<{ nonce: string; hashedNonce: string }> => {
    const nonce = Crypto.getRandomBytes(32).reduce(
      (acc, byte) => acc + byte.toString(16).padStart(2, '0'),
      '',
    );
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
    return { nonce, hashedNonce };
  };

  #openOAuth = async (
    provider: OAuthStartProvider,
    mode: OAuthStartMode,
    userHint?: string,
  ): Promise<Result<string, AuthError>> => {
    const redirectUri = this.#getRedirectUri(provider);
    const authUrl = this.#getOAuthWebStartUrl(provider, redirectUri, mode, userHint);

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri, {
      createTask: false,
    });

    if (result.type === 'success') {
      const code = this.#extractCodeFromUrl(result.url);
      if (!code) {
        const oauthError = this.#extractOAuthErrorFromUrl(result.url);
        if (oauthError.code || oauthError.description) {
          return err(
            AuthErrors.providerError(
              provider,
              oauthError.description ?? `${provider} 로그인에 실패했어요 (${oauthError.code})`,
            ),
          );
        }
        return err(AuthErrors.noCodeReceived());
      }
      return ok(code);
    }

    if (
      result.type === WebBrowserResultType.CANCEL ||
      result.type === WebBrowserResultType.DISMISS
    ) {
      return err(AuthErrors.loginCancelled());
    }

    return err(AuthErrors.unknown('OAuth 인증 중 문제가 발생했어요'));
  };

  openKakaoLogin = (): Promise<Result<string, AuthError>> => {
    return this.#openOAuth('kakao', 'login');
  };

  openNaverLogin = (): Promise<Result<string, AuthError>> => {
    return this.#openOAuth('naver', 'login');
  };

  openGoogleLogin = (): Promise<Result<string, AuthError>> => {
    return this.#openOAuth('google', 'login');
  };

  openAppleLogin = async (): Promise<Result<AuthTokens, AuthServiceError>> => {
    try {
      const { nonce, hashedNonce } = await this.#generateNonce();

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      const idToken = credential.identityToken;
      if (!idToken) {
        return err(AuthErrors.providerError('apple', 'Apple 인증 토큰을 받지 못했어요'));
      }

      const input: AppleMobileCallbackInput = {
        idToken,
        nonce,
        userName: credential.fullName?.givenName ?? undefined,
        deviceType: 'IOS',
      };

      const result = await this.#publicHttpClient.post<AuthTokensDTO>(
        'v1/auth/apple/callback',
        input,
      );
      if (!result.ok) return result;

      const tokens = this.#parseAuthTokens(result);
      await this.#saveTokens(tokens.accessToken, tokens.refreshToken);
      return ok(tokens);
    } catch (error) {
      if (isAuthError(error)) {
        return err(error);
      }
      if (isExpoCodedError(error)) {
        return err(AuthErrors.fromExpoAppleError(error));
      }
      return err(AuthErrors.fromUnknown(error));
    }
  };

  emailLogin = async (email: string, password: string): Promise<Result<AuthTokens, ApiError>> => {
    const result = await this.#publicHttpClient.post<AuthTokensDTO>('v1/auth/login', {
      email,
      password,
      deviceType: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
    });
    if (!result.ok) return result;

    const tokens = this.#parseAuthTokens(result);
    await this.#saveTokens(tokens.accessToken, tokens.refreshToken);
    return ok(tokens);
  };

  exchangeCode = async (request: ExchangeCodeInput): Promise<Result<AuthTokens, ApiError>> => {
    const result = await this.#publicHttpClient.post<AuthTokensDTO>('v1/auth/exchange', request);
    if (!result.ok) return result;

    const tokens = this.#parseAuthTokens(result);
    await this.#saveTokens(tokens.accessToken, tokens.refreshToken);
    return ok(tokens);
  };

  logout = async (): Promise<Result<void, ApiError>> => {
    try {
      const result = await this.#authHttpClient.post('v1/auth/logout');
      return result.ok ? ok(undefined) : result;
    } finally {
      await this.#clearTokens();
    }
  };

  verifyEmail = async (input: VerifyEmailInput): Promise<Result<AuthTokens, ApiError>> => {
    const result = await this.#publicHttpClient.post<AuthTokensDTO>('v1/auth/verify-email', input);
    if (!result.ok) return result;

    const tokens = this.#parseAuthTokens(result);
    await this.#saveTokens(tokens.accessToken, tokens.refreshToken);
    return ok(tokens);
  };

  getPreference = async (): Promise<Result<Preference, ApiError>> => {
    const result = await this.#authHttpClient.get<PreferenceResponse>('v1/auth/preference');
    if (!result.ok) return result;

    const parsed = preferenceResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[AuthService] Invalid getPreference response: ${parsed.error.message}`);
    }

    return ok(toPreference(parsed.data));
  };

  updatePreference = async (
    input: UpdatePreferenceInput,
  ): Promise<Result<Preference, ApiError>> => {
    const result = await this.#authHttpClient.patch<PreferenceResponse>(
      'v1/auth/preference',
      input,
    );
    if (!result.ok) return result;

    const parsed = updatePreferenceResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[AuthService] Invalid updatePreference response: ${parsed.error.message}`,
      );
    }

    return ok(toPreference(parsed.data));
  };

  getConsent = async (): Promise<Result<Consent, ApiError>> => {
    const result = await this.#authHttpClient.get<ConsentResponse>('v1/auth/consent');
    if (!result.ok) return result;

    const parsed = consentResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[AuthService] Invalid getConsent response: ${parsed.error.message}`);
    }

    return ok(toConsent(parsed.data));
  };

  updateMarketingConsent = async (
    input: UpdateMarketingConsentInput,
  ): Promise<Result<UpdateMarketingConsentResult, ApiError>> => {
    const result = await this.#authHttpClient.patch<UpdateMarketingConsentResponse>(
      'v1/auth/consent/marketing',
      input,
    );
    if (!result.ok) return result;

    const parsed = updateMarketingConsentResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[AuthService] Invalid updateMarketingConsent response: ${parsed.error.message}`,
      );
    }

    return ok(toUpdateMarketingConsentResult(parsed.data));
  };

  register = async (input: RegisterInput): Promise<Result<RegisterResult, ApiError>> => {
    const result = await this.#publicHttpClient.post<RegisterResponse>('v1/auth/register', input);
    if (!result.ok) return result;

    const parsed = registerResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[AuthService] Invalid register response: ${parsed.error.message}`);
    }

    return ok(toRegisterResult(parsed.data));
  };

  resendVerification = async (
    input: ResendVerificationInput,
  ): Promise<Result<ResendVerificationResult, ApiError>> => {
    const result = await this.#publicHttpClient.post<ResendVerificationResponse>(
      'v1/auth/resend-verification',
      input,
    );
    if (!result.ok) return result;

    const parsed = resendVerificationResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[AuthService] Invalid resendVerification response: ${parsed.error.message}`,
      );
    }

    return ok(toResendVerificationResult(parsed.data));
  };

  getLinkedAccounts = async (): Promise<Result<LinkedAccountsResult, ApiError>> => {
    const result =
      await this.#authHttpClient.get<LinkedAccountsResponse>('v1/auth/linked-accounts');
    if (!result.ok) return result;

    const parsed = linkedAccountsResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[AuthService] Invalid getLinkedAccounts response: ${parsed.error.message}`,
      );
    }

    return ok(toLinkedAccounts(parsed.data));
  };

  openLinkOAuth = (
    provider: OAuthStartProvider,
    userHint?: string,
  ): Promise<Result<string, AuthError>> => {
    return this.#openOAuth(provider, 'link', userHint);
  };

  linkAccount = async (
    provider: OAuthProviderSlug,
  ): Promise<Result<{ message: string }, AuthServiceError>> => {
    if (provider === 'apple') {
      return this.linkApple();
    }

    const oauthResult = await this.openLinkOAuth(provider);
    if (!oauthResult.ok) {
      return err(oauthResult.error);
    }

    return this.linkWithCode(oauthResult.value);
  };

  linkWithCode = async (code: string): Promise<Result<{ message: string }, ApiError>> => {
    return this.#authHttpClient.post('v1/auth/link-with-code', { code });
  };

  linkApple = async (): Promise<Result<{ message: string }, AuthServiceError>> => {
    try {
      const { nonce, hashedNonce } = await this.#generateNonce();

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      const idToken = credential.identityToken;
      if (!idToken) {
        return err(AuthErrors.providerError('apple', 'Apple 인증 토큰을 받지 못했어요'));
      }

      return this.#authHttpClient.post('v1/auth/link', { provider: 'APPLE', idToken, nonce });
    } catch (error) {
      if (isAuthError(error)) {
        return err(error);
      }
      if (isExpoCodedError(error)) {
        return err(AuthErrors.fromExpoAppleError(error));
      }
      return err(AuthErrors.fromUnknown(error));
    }
  };

  unlinkAccount = async (
    provider: OAuthProvider,
  ): Promise<Result<{ message: string }, ApiError>> => {
    return this.#authHttpClient.delete(`v1/auth/linked-accounts/${provider}`);
  };

  forgotPassword = async (
    input: ForgotPasswordInput,
  ): Promise<Result<ForgotPasswordResult, ApiError>> => {
    const result = await this.#publicHttpClient.post<ForgotPasswordResponse>(
      'v1/auth/forgot-password',
      input,
    );
    if (!result.ok) return result;

    const parsed = forgotPasswordResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[AuthService] Invalid forgotPassword response: ${parsed.error.message}`,
      );
    }

    return ok(toForgotPasswordResult(parsed.data));
  };

  resetPassword = async (
    input: ResetPasswordInput,
  ): Promise<Result<ResetPasswordResult, ApiError>> => {
    const result = await this.#publicHttpClient.post<ResetPasswordResponse>(
      'v1/auth/reset-password',
      input,
    );
    if (!result.ok) return result;

    const parsed = resetPasswordResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[AuthService] Invalid resetPassword response: ${parsed.error.message}`);
    }

    return ok(toResetPasswordResult(parsed.data));
  };

  changePassword = async (
    input: ChangePasswordInput,
  ): Promise<Result<ChangePasswordResult, ApiError>> => {
    const result = await this.#authHttpClient.patch<ChangePasswordResponse>(
      'v1/auth/password',
      input,
    );
    if (!result.ok) return result;

    const parsed = changePasswordResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[AuthService] Invalid changePassword response: ${parsed.error.message}`,
      );
    }

    return ok(toChangePasswordResult(parsed.data));
  };

  deleteAccount = async (
    input: DeleteAccountInput,
  ): Promise<Result<DeleteAccountResult, ApiError>> => {
    const result = await this.#authHttpClient.delete<DeleteAccountResponse>('v1/auth/account', {
      body: input,
    });
    if (!result.ok) return result;

    const parsed = deleteAccountResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[AuthService] Invalid deleteAccount response: ${parsed.error.message}`);
    }

    await this.#clearTokens();
    return ok(toDeleteAccountResult(parsed.data));
  };
}
