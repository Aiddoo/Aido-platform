import type { DeleteAccountInput, ExchangeCodeInput, VerifyEmailInput } from '@aido/api';
import type { ApiError } from '@src/core/errors/api-error';
import { err, ok, type Result } from '@src/core/errors/result';
import type { AppLogger } from '@src/core/ports/app-logger';
import type { AppleSignInResult, SocialAuthGateway } from '@src/core/ports/social-auth-gateway';
import type { TokenStore } from '@src/core/ports/token-store';
import { BusinessError, getErrorMessage } from '@src/shared/errors';
import { match } from 'ts-pattern';

import type { AuthApi } from '../apis/auth.api';
import { toAppleLinkRequest, toAppleSignInRequest, toEmailLoginRequest } from '../apis/auth.mapper';
import { AUTH_LOG_EVENT } from '../constants/auth-log-events';
import { AUTH_ERROR_CODE } from '../domains/auth.error';
import { type AuthTokens } from '../domains/auth.model';
import {
  OAuthPolicy,
  type OAuthProviderSlug,
  type OAuthStartMode,
  type OAuthStartProvider,
} from '../domains/oauth.model';

type SignInError = ApiError | BusinessError;
type AppleCredential = Extract<AppleSignInResult, { type: 'success' }>;

interface SignInServicePorts {
  authApi: Pick<
    AuthApi,
    | 'login'
    | 'signInWithApple'
    | 'exchangeCode'
    | 'verifyEmail'
    | 'linkWithCode'
    | 'linkWithIdToken'
    | 'deleteAccount'
  >;
  tokenStore: Pick<TokenStore, 'save' | 'clear'>;
  socialAuthGateway: Pick<SocialAuthGateway, 'openOAuthSession' | 'signInWithApple'>;
  /** 서버가 기기 종류별로 세션을 구분한다. 조립이 실행 플랫폼에서 정한다 */
  deviceType: 'IOS' | 'ANDROID';
  logger: Pick<AppLogger, 'warn'>;
}

/** 소셜 인증 창과 이 기기의 토큰을 엮는다. 인증 상태 전환과 추적은 mutation이 한다 */
export class SignInService {
  readonly #authApi: SignInServicePorts['authApi'];
  readonly #tokenStore: SignInServicePorts['tokenStore'];
  readonly #socialAuthGateway: SignInServicePorts['socialAuthGateway'];
  readonly #deviceType: SignInServicePorts['deviceType'];
  readonly #logger: SignInServicePorts['logger'];

  constructor({ authApi, tokenStore, socialAuthGateway, deviceType, logger }: SignInServicePorts) {
    this.#authApi = authApi;
    this.#tokenStore = tokenStore;
    this.#socialAuthGateway = socialAuthGateway;
    this.#deviceType = deviceType;
    this.#logger = logger;
  }

  emailLogin = async (credentials: { email: string; password: string }) =>
    this.#saveTokens(await this.#authApi.login(toEmailLoginRequest(credentials, this.#deviceType)));

  /** 브라우저 로그인이 돌려준 일회용 코드를 토큰으로 바꾼다 */
  exchangeCode = async (input: ExchangeCodeInput) =>
    this.#saveTokens(await this.#authApi.exchangeCode(input));

  verifyEmail = async (input: VerifyEmailInput) =>
    this.#saveTokens(await this.#authApi.verifyEmail(input));

  openKakaoLogin = () => this.#openOAuth('kakao', 'login');

  openNaverLogin = () => this.#openOAuth('naver', 'login');

  openGoogleLogin = () => this.#openOAuth('google', 'login');

  openAppleLogin = async (): Promise<Result<AuthTokens, SignInError>> => {
    const credential = await this.#signInWithApple();
    if (!credential.ok) {
      return credential;
    }
    return this.#saveTokens(
      await this.#authApi.signInWithApple(toAppleSignInRequest(credential.value, this.#deviceType)),
    );
  };

  /** 인증된 요청이라 토큰을 저장하지 않는다 */
  linkAccount = async (
    provider: OAuthProviderSlug,
  ): Promise<Result<{ message: string }, SignInError>> => {
    if (provider === 'apple') {
      const credential = await this.#signInWithApple();
      if (!credential.ok) {
        return credential;
      }
      return this.#authApi.linkWithIdToken(toAppleLinkRequest(credential.value));
    }

    const code = await this.#openOAuth(provider, 'link');
    if (!code.ok) {
      return code;
    }
    return this.#authApi.linkWithCode(code.value);
  };

  /** 세션 만료(`SessionManager.end`)와 로그아웃 말고 토큰을 지우는 유일한 경로다 */
  deleteAccount = async (input: DeleteAccountInput) => {
    const result = await this.#authApi.deleteAccount(input);
    if (result.ok) {
      // 서버에서는 이미 탈퇴했다. 기기 토큰을 못 지워도 실패로 돌리지 않고 남은 토큰은 다음 요청 거부로 정리된다
      await this.#tokenStore.clear().catch((error: unknown) => {
        this.#logger.warn(AUTH_LOG_EVENT.LOCAL_SESSION_CLEAR_FAILED, {
          error: getErrorMessage(error),
        });
      });
    }
    return result;
  };

  /** 저장이 실패하면(잠긴 키체인) 던져 로그인 실패로 끝난다. 인증 상태는 바뀌지 않는다 */
  #saveTokens = async (result: Result<AuthTokens, ApiError>) => {
    if (result.ok) {
      const { accessToken, refreshToken } = result.value;
      await this.#tokenStore.save({ accessToken, refreshToken });
    }
    return result;
  };

  #openOAuth = async (
    provider: OAuthStartProvider,
    mode: OAuthStartMode,
  ): Promise<Result<string, BusinessError>> => {
    const session = await this.#socialAuthGateway.openOAuthSession({
      startPath: `v1/auth/${provider}/start`,
      callbackPath: `auth/${provider}`,
      params: { mode },
    });

    return match(session)
      .returnType<Result<string, BusinessError>>()
      .with({ type: 'success' }, ({ url, queryParams }) => {
        const code = OAuthPolicy.findOAuthCode(url, queryParams);
        if (code) {
          return ok(code);
        }
        // 서버가 실어 보낸 오류 코드면 errors 카탈로그의 문구를 쓴다
        if (queryParams.error || queryParams.error_description) {
          return err(new BusinessError(queryParams.error ?? AUTH_ERROR_CODE.PROVIDER_ERROR));
        }
        return err(new BusinessError(AUTH_ERROR_CODE.NO_CODE_RECEIVED));
      })
      .with({ type: 'cancelled' }, () => err(new BusinessError(AUTH_ERROR_CODE.LOGIN_CANCELLED)))
      .with({ type: 'failed' }, () => err(new BusinessError(AUTH_ERROR_CODE.UNKNOWN)))
      .exhaustive();
  };

  #signInWithApple = async (): Promise<Result<AppleCredential, BusinessError>> => {
    const result = await this.#socialAuthGateway.signInWithApple();

    return match(result)
      .returnType<Result<AppleCredential, BusinessError>>()
      .with({ type: 'success' }, (credential) => ok(credential))
      .with({ type: 'cancelled' }, () => err(new BusinessError(AUTH_ERROR_CODE.LOGIN_CANCELLED)))
      .with({ type: 'no-token' }, () => err(new BusinessError(AUTH_ERROR_CODE.APPLE_NO_TOKEN)))
      .with({ type: 'invalid-response' }, () =>
        err(new BusinessError(AUTH_ERROR_CODE.APPLE_INVALID_RESPONSE)),
      )
      .with({ type: 'unavailable' }, () =>
        err(new BusinessError(AUTH_ERROR_CODE.APPLE_UNAVAILABLE)),
      )
      .with({ type: 'failed' }, () => err(new BusinessError(AUTH_ERROR_CODE.UNKNOWN)))
      .exhaustive();
  };
}
