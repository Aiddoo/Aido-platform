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
import { AuthClientError } from '../models/auth.error';
import type { AuthTokens, User } from '../models/auth.model';
import type { AuthRepository } from '../repositories/auth.repository';
import { toAuthTokens, toUser } from './auth.mapper';

type OAuthProvider = 'kakao' | 'naver' | 'google';

/**
 * expo-modules-core의 CodedError 타입 정의
 * - expo-apple-authentication에서 발생하는 에러 타입
 * - ERR_REQUEST_CANCELED: 사용자가 로그인 창을 닫음
 * @see https://docs.expo.dev/versions/latest/sdk/apple-authentication/#error-codes
 */
interface ExpoCodedError extends Error {
  code: string;
}

const isExpoCodedError = (error: unknown): error is ExpoCodedError =>
  error instanceof Error && 'code' in error && typeof error.code === 'string';

export class AuthService {
  constructor(private readonly _authRepository: AuthRepository) {}

  /**
   * OAuth Redirect URI 생성
   * - makeRedirectUri: 환경(Expo Go, Dev Build, Production)에 따라 적절한 URI 생성
   */
  private getRedirectUri = (provider: OAuthProvider): string =>
    makeRedirectUri({
      scheme: ENV.SCHEME,
      path: match(provider)
        .with('kakao', () => 'auth/kakao')
        .with('naver', () => 'auth/naver')
        .with('google', () => 'auth/google')
        .exhaustive(),
    });

  /**
   * OAuth URL에서 authorization code 추출
   */
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
  /**
   * OAuth 로그인 통합 메서드
   * @throws {AuthClientError} 로그인 취소, 네트워크 오류 등
   */
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

        if (!code) throw new AuthClientError('validation', '인증 코드를 찾을 수 없어요');

        return code;
      })
      .with({ type: WebBrowserResultType.CANCEL }, () => {
        throw new AuthClientError('cancelled', '로그인이 취소되었어요');
      })
      .with({ type: WebBrowserResultType.DISMISS }, () => {
        throw new AuthClientError('cancelled', '로그인이 취소되었어요');
      })
      .with({ type: WebBrowserResultType.OPENED }, () => {
        throw new AuthClientError('unknown', '브라우저가 열렸지만 응답이 없어요');
      })
      .with({ type: WebBrowserResultType.LOCKED }, () => {
        throw new AuthClientError('validation', '다른 인증이 진행 중이에요');
      })
      .exhaustive();
  };

  // Public OAuth API
  openKakaoLogin = (): Promise<string> => this.openOAuthLogin('kakao');

  openNaverLogin = (): Promise<string> => this.openOAuthLogin('naver');

  openGoogleLogin = (): Promise<string> => this.openOAuthLogin('google');

  /**
   * Apple 로그인 (iOS only)
   * - expo-apple-authentication 네이티브 SDK 사용
   * - Android에서는 호출하면 안 됨 (UI에서 Platform.OS 체크 필요)
   */
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
        throw new AuthClientError('validation', 'Apple ID 토큰을 받지 못했어요');
      }

      const input: AppleMobileCallbackInput = {
        idToken,
        userName: credential.fullName?.givenName ?? undefined,
        deviceType: 'IOS',
      };

      const dto = await this._authRepository.appleLogin(input);
      return toAuthTokens(dto);
    } catch (error) {
      if (error instanceof AuthClientError) {
        throw error;
      }
      // expo-apple-authentication의 CodedError 처리
      // ERR_REQUEST_CANCELED: 사용자가 로그인 창을 닫음
      if (isExpoCodedError(error) && error.code === 'ERR_REQUEST_CANCELED') {
        throw AuthClientError.cancelled();
      }
      throw error;
    }
  };

  // Auth API Methods
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
