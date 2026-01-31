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
import { match } from 'ts-pattern';
import {
  AppleAuthError,
  AuthCancelledError,
  AuthError,
  AuthValidationError,
  isAuthError,
  isExpoCodedError,
} from '../models/auth.error';
import type { AuthTokens, User } from '../models/auth.model';
import type { AuthRepository } from '../repositories/auth.repository';
import { toAuthTokens, toUser } from './auth.mapper';

type OAuthProvider = 'kakao' | 'naver' | 'google';

export class AuthService {
  constructor(private readonly _authRepository: AuthRepository) {}

  private getRedirectUri = (provider: OAuthProvider): string =>
    makeRedirectUri({
      scheme: ENV.SCHEME,
      path: match(provider)
        .with('kakao', () => 'auth/kakao')
        .with('naver', () => 'auth/naver')
        .with('google', () => 'auth/google')
        .exhaustive(),
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

    const authUrl = match(provider)
      .with('kakao', () => this._authRepository.getKakaoAuthUrl(redirectUri))
      .with('naver', () => this._authRepository.getNaverAuthUrl(redirectUri))
      .with('google', () => this._authRepository.getGoogleAuthUrl(redirectUri))
      .exhaustive();

    // createTask: false → Android에서 새 태스크 생성 안 함 → iOS와 동일하게 URL 캡처
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri, {
      createTask: false,
    });

    return match(result)
      .with({ type: 'success' }, ({ url }) => {
        const code = this.extractCodeFromUrl(url);

        if (!code) throw new AuthValidationError('인증 코드를 찾을 수 없어요');

        return code;
      })
      .with({ type: WebBrowserResultType.CANCEL }, () => {
        throw new AuthCancelledError();
      })
      .with({ type: WebBrowserResultType.DISMISS }, () => {
        throw new AuthCancelledError();
      })
      .with({ type: WebBrowserResultType.OPENED }, () => {
        throw new AuthError('브라우저가 열렸지만 응답이 없어요');
      })
      .with({ type: WebBrowserResultType.LOCKED }, () => {
        throw new AuthValidationError('다른 인증이 진행 중이에요');
      })
      .exhaustive();
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

  // iOS only - Android에서는 호출하면 안 됨 (UI에서 Platform.OS 체크 필요)
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
        throw new AuthValidationError('Apple ID 토큰을 받지 못했어요');
      }

      const input: AppleMobileCallbackInput = {
        idToken,
        userName: credential.fullName?.givenName ?? undefined,
        deviceType: 'IOS',
      };

      const dto = await this._authRepository.appleLogin(input);
      return toAuthTokens(dto);
    } catch (error) {
      if (isAuthError(error)) {
        throw error;
      }
      if (isExpoCodedError(error)) {
        throw AppleAuthError.fromExpoError(error);
      }
      throw new AuthError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했어요');
    }
  };

  emailLogin = async (email: string, password: string): Promise<AuthTokens> => {
    const dto = await this._authRepository.emailLogin(email, password);
    return toAuthTokens(dto);
  };

  exchangeCode = async (request: ExchangeCodeInput): Promise<AuthTokens> => {
    const dto = await this._authRepository.exchangeCode(request);
    return toAuthTokens(dto);
  };

  getCurrentUser = async (): Promise<User> => {
    const dto = await this._authRepository.getCurrentUser();
    return toUser(dto);
  };

  logout = async (): Promise<void> => {
    return this._authRepository.logout();
  };

  getPreference = async (): Promise<PreferenceResponse> => {
    return this._authRepository.getPreference();
  };

  updatePreference = async (input: UpdatePreferenceInput): Promise<UpdatePreferenceResponse> => {
    return this._authRepository.updatePreference(input);
  };

  getConsent = async (): Promise<ConsentResponse> => {
    return this._authRepository.getConsent();
  };

  updateMarketingConsent = async (
    input: UpdateMarketingConsentInput,
  ): Promise<UpdateMarketingConsentResponse> => {
    return this._authRepository.updateMarketingConsent(input);
  };
}
