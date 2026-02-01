import type {
  AppleMobileCallbackInput,
  ConsentResponse,
  ExchangeCodeInput,
  PreferenceResponse,
  UpdateMarketingConsentInput,
  UpdateMarketingConsentResponse,
  UpdatePreferenceInput,
  UpdatePreferenceResponse,
} from '@aido/validators';
import { ENV } from '@src/shared/config/env';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { WebBrowserResultType } from 'expo-web-browser';
import {
  AuthError,
  AuthLoginCancelledError,
  AuthProviderError,
  AuthValidationError,
  isAuthError,
  isExpoCodedError,
} from '../models/auth.error';
import type { AuthTokens, User } from '../models/auth.model';
import type { AuthRepository } from '../repositories/auth.repository';
import { toAuthTokens, toUser } from './auth.mapper';

type OAuthProvider = 'kakao' | 'naver' | 'google';

const OAUTH_PATHS: Record<OAuthProvider, string> = {
  kakao: 'auth/kakao',
  naver: 'auth/naver',
  google: 'auth/google',
};

export class AuthService {
  readonly #authRepository: AuthRepository;

  constructor(authRepository: AuthRepository) {
    this.#authRepository = authRepository;
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

  private openOAuthLogin = async (provider: OAuthProvider): Promise<string> => {
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
        throw new AuthValidationError(null, null);
      }
      return code;
    }

    if (
      result.type === WebBrowserResultType.CANCEL ||
      result.type === WebBrowserResultType.DISMISS
    ) {
      throw new AuthLoginCancelledError();
    }

    // WebBrowserResultType.OPENED, WebBrowserResultType.LOCKED
    throw new AuthError('OAuth 인증 중 문제가 발생했어요');
  };

  openKakaoLogin = (): Promise<string> => {
    return this.openOAuthLogin('kakao');
  };

  openNaverLogin = (): Promise<string> => {
    return this.openOAuthLogin('naver');
  };

  openGoogleLogin = (): Promise<string> => {
    return this.openOAuthLogin('google');
  };

  openAppleLogin = async (): Promise<AuthTokens> => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const idToken = credential.identityToken;
      if (!idToken) {
        throw new AuthProviderError('apple', 'Apple 인증 토큰을 받지 못했어요');
      }

      const input: AppleMobileCallbackInput = {
        idToken,
        userName: credential.fullName?.givenName ?? undefined,
        deviceType: 'IOS',
      };

      const dto = await this.#authRepository.appleLogin(input);
      return toAuthTokens(dto);
    } catch (error) {
      if (isAuthError(error)) {
        throw error;
      }
      if (isExpoCodedError(error)) {
        throw AuthError.fromExpoAppleError(error);
      }
      throw AuthError.fromUnknown(error);
    }
  };

  emailLogin = async (email: string, password: string): Promise<AuthTokens> => {
    const dto = await this.#authRepository.emailLogin(email, password);
    return toAuthTokens(dto);
  };

  exchangeCode = async (request: ExchangeCodeInput): Promise<AuthTokens> => {
    const dto = await this.#authRepository.exchangeCode(request);
    return toAuthTokens(dto);
  };

  getCurrentUser = async (): Promise<User> => {
    const dto = await this.#authRepository.getCurrentUser();
    return toUser(dto);
  };

  logout = async (): Promise<void> => {
    return this.#authRepository.logout();
  };

  getPreference = async (): Promise<PreferenceResponse> => {
    return this.#authRepository.getPreference();
  };

  updatePreference = async (input: UpdatePreferenceInput): Promise<UpdatePreferenceResponse> => {
    return this.#authRepository.updatePreference(input);
  };

  getConsent = async (): Promise<ConsentResponse> => {
    return this.#authRepository.getConsent();
  };

  updateMarketingConsent = async (
    input: UpdateMarketingConsentInput,
  ): Promise<UpdateMarketingConsentResponse> => {
    return this.#authRepository.updateMarketingConsent(input);
  };
}
