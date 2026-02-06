import type {
  ExchangeCodeInput,
  RegisterInput,
  ResendVerificationInput,
  UpdateMarketingConsentInput,
  UpdatePreferenceInput,
  VerifyEmailInput,
} from '@aido/validators';
import type { Storage } from '@src/core/ports/storage';
import { ENV } from '@src/shared/config/env';
import type { ApiError } from '@src/shared/errors/api-error';
import { err, ok, type Result } from '@src/shared/errors/result';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { WebBrowserResultType } from 'expo-web-browser';

import { type AuthError, AuthErrors, isAuthError, isExpoCodedError } from '../models/auth.error';
import type {
  AuthTokens,
  Consent,
  Preference,
  RegisterResult,
  ResendVerificationResult,
  UpdateMarketingConsentResult,
  User,
} from '../models/auth.model';
import type { AuthRepository } from '../repositories/auth.repository';

type OAuthProvider = 'kakao' | 'naver' | 'google';

const OAUTH_PATHS: Record<OAuthProvider, string> = {
  kakao: 'auth/kakao',
  naver: 'auth/naver',
  google: 'auth/google',
};

export type AuthServiceError = ApiError | AuthError;

export class AuthService {
  readonly #authRepository: AuthRepository;
  readonly #storage: Storage;

  constructor(authRepository: AuthRepository, storage: Storage) {
    this.#authRepository = authRepository;
    this.#storage = storage;
  }

  private getRedirectUri = (provider: OAuthProvider): string =>
    makeRedirectUri({
      scheme: ENV.SCHEME,
      path: OAUTH_PATHS[provider],
    });

  private extractCodeFromUrl = (url: string): string | null => {
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

    return null;
  };

  private saveTokens = async (accessToken: string, refreshToken: string): Promise<void> => {
    await Promise.all([
      this.#storage.set('accessToken', accessToken),
      this.#storage.set('refreshToken', refreshToken),
    ]);
  };

  private clearTokens = async (): Promise<void> => {
    await Promise.all([this.#storage.remove('accessToken'), this.#storage.remove('refreshToken')]);
  };

  private openOAuthLogin = async (provider: OAuthProvider): Promise<Result<string, AuthError>> => {
    const redirectUri = this.getRedirectUri(provider);

    const authUrlGetters: Record<OAuthProvider, (uri: string) => string> = {
      kakao: this.#authRepository.getKakaoAuthUrl,
      naver: this.#authRepository.getNaverAuthUrl,
      google: this.#authRepository.getGoogleAuthUrl,
    };

    const authUrl = authUrlGetters[provider](redirectUri);

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri, {
      createTask: false,
    });

    if (result.type === 'success') {
      const code = this.extractCodeFromUrl(result.url);
      if (!code) {
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

    // WebBrowserResultType.OPENED, WebBrowserResultType.LOCKED
    return err(AuthErrors.unknown('OAuth 인증 중 문제가 발생했어요'));
  };

  openKakaoLogin = (): Promise<Result<string, AuthError>> => {
    return this.openOAuthLogin('kakao');
  };

  openNaverLogin = (): Promise<Result<string, AuthError>> => {
    return this.openOAuthLogin('naver');
  };

  openGoogleLogin = (): Promise<Result<string, AuthError>> => {
    return this.openOAuthLogin('google');
  };

  openAppleLogin = async (): Promise<Result<AuthTokens, AuthServiceError>> => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const idToken = credential.identityToken;
      if (!idToken) {
        return err(AuthErrors.providerError('apple', 'Apple 인증 토큰을 받지 못했어요'));
      }

      const result = await this.#authRepository.appleLogin({
        idToken,
        userName: credential.fullName?.givenName ?? undefined,
        deviceType: 'IOS',
      });
      if (!result.ok) return result;

      await this.saveTokens(result.value.accessToken, result.value.refreshToken);
      return result;
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
    const result = await this.#authRepository.emailLogin(email, password);
    if (!result.ok) return result;

    await this.saveTokens(result.value.accessToken, result.value.refreshToken);
    return result;
  };

  exchangeCode = async (request: ExchangeCodeInput): Promise<Result<AuthTokens, ApiError>> => {
    const result = await this.#authRepository.exchangeCode(request);
    if (!result.ok) return result;

    await this.saveTokens(result.value.accessToken, result.value.refreshToken);
    return result;
  };

  getCurrentUser = async (): Promise<Result<User, ApiError>> => {
    return this.#authRepository.getCurrentUser();
  };

  logout = async (): Promise<Result<void, ApiError>> => {
    const result = await this.#authRepository.logout();
    // 성공/실패 관계없이 로컬 토큰은 삭제
    await this.clearTokens();
    return result;
  };

  getPreference = async (): Promise<Result<Preference, ApiError>> => {
    return this.#authRepository.getPreference();
  };

  updatePreference = async (
    input: UpdatePreferenceInput,
  ): Promise<Result<Preference, ApiError>> => {
    return this.#authRepository.updatePreference(input);
  };

  getConsent = async (): Promise<Result<Consent, ApiError>> => {
    return this.#authRepository.getConsent();
  };

  updateMarketingConsent = async (
    input: UpdateMarketingConsentInput,
  ): Promise<Result<UpdateMarketingConsentResult, ApiError>> => {
    return this.#authRepository.updateMarketingConsent(input);
  };

  register = async (input: RegisterInput): Promise<Result<RegisterResult, ApiError>> => {
    return this.#authRepository.register(input);
  };

  verifyEmail = async (input: VerifyEmailInput): Promise<Result<AuthTokens, ApiError>> => {
    const result = await this.#authRepository.verifyEmail(input);
    if (!result.ok) return result;

    await this.saveTokens(result.value.accessToken, result.value.refreshToken);
    return result;
  };

  resendVerification = async (
    input: ResendVerificationInput,
  ): Promise<Result<ResendVerificationResult, ApiError>> => {
    return this.#authRepository.resendVerification(input);
  };
}
