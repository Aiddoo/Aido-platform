import {
  type AppleMobileCallbackInput,
  authTokensSchema,
  type ChangePasswordInput,
  changePasswordResponseSchema,
  type DeleteAccountInput,
  deleteAccountResponseSchema,
  type ExchangeCodeInput,
  type ForgotPasswordInput,
  forgotPasswordResponseSchema,
  linkAccountResponseSchema,
  linkedAccountsResponseSchema,
  type RegisterInput,
  registerResponseSchema,
  type ResendVerificationInput,
  resendVerificationResponseSchema,
  type ResetPasswordInput,
  resetPasswordResponseSchema,
  unlinkAccountResponseSchema,
  type VerifyEmailInput,
} from '@aido/api';
import type { ApiError } from '@src/core/errors/api-error';
import { err, ok, type Result } from '@src/core/errors/result';
import type { HttpClient, RequestConfig } from '@src/core/ports/http';
import type { AppleSignInResult, SocialAuthGateway } from '@src/core/ports/social-auth-gateway';
import type { TokenStore } from '@src/core/ports/token-store';
import { BusinessError } from '@src/shared/errors/business-error';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';
import { identity } from 'es-toolkit';
import { match } from 'ts-pattern';

import { AUTH_ERROR_CODE } from '../domains/auth.error';
import { extractOAuthCode } from '../domains/oauth.model';
import type { AuthTokens } from '../schemas/auth.schema';
import type {
  OAuthProvider,
  OAuthProviderSlug,
  OAuthStartMode,
  OAuthStartProvider,
} from '../schemas/oauth.schema';
import {
  toAuthTokens,
  toChangePasswordResult,
  toDeleteAccountResult,
  toForgotPasswordResult,
  toLinkedAccounts,
  toRegisterResult,
  toResendVerificationResult,
  toResetPasswordResult,
} from './auth.mapper';

type AuthServiceError = ApiError | BusinessError;

interface AuthServicePorts {
  publicHttpClient: HttpClient;
  authHttpClient: HttpClient;
  tokenStore: TokenStore;
  socialAuthGateway: SocialAuthGateway;
}

export class AuthService {
  readonly #publicHttpClient: HttpClient;
  readonly #authHttpClient: HttpClient;
  readonly #tokenStore: TokenStore;
  readonly #socialAuthGateway: SocialAuthGateway;

  constructor({
    publicHttpClient,
    authHttpClient,
    tokenStore,
    socialAuthGateway,
  }: AuthServicePorts) {
    this.#publicHttpClient = publicHttpClient;
    this.#authHttpClient = authHttpClient;
    this.#tokenStore = tokenStore;
    this.#socialAuthGateway = socialAuthGateway;
  }

  /** 로그인 응답의 토큰을 저장한다. 다음 요청부터 이 토큰을 쓴다 */
  #saveTokens = async (response: Result<unknown, ApiError>) => {
    const result = parseApiResponse(
      response,
      authTokensSchema,
      toAuthTokens,
      '[AuthService] Invalid auth tokens response',
    );
    if (result.ok) {
      const { accessToken, refreshToken } = result.value;
      await this.#tokenStore.save({ accessToken, refreshToken });
    }
    return result;
  };

  #openOAuth = async (
    provider: OAuthStartProvider,
    mode: OAuthStartMode,
    userHint?: string,
  ): Promise<Result<string, BusinessError>> => {
    const session = await this.#socialAuthGateway.openOAuthSession({
      startPath: `v1/auth/${provider}/start`,
      callbackPath: `auth/${provider}`,
      params: userHint ? { mode, user_hint: userHint } : { mode },
    });

    return match(session)
      .returnType<Result<string, BusinessError>>()
      .with({ type: 'success' }, ({ url, queryParams }) => {
        const code = extractOAuthCode(url, queryParams);
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

  #signInWithApple = async () => {
    const result = await this.#socialAuthGateway.signInWithApple();

    return match(result)
      .returnType<Result<Extract<AppleSignInResult, { type: 'success' }>, BusinessError>>()
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

  openKakaoLogin = () => this.#openOAuth('kakao', 'login');

  openNaverLogin = () => this.#openOAuth('naver', 'login');

  openGoogleLogin = () => this.#openOAuth('google', 'login');

  openAppleLogin = async (): Promise<Result<AuthTokens, AuthServiceError>> => {
    const credential = await this.#signInWithApple();
    if (!credential.ok) {
      return credential;
    }

    const { identityToken, nonce, givenName } = credential.value;
    const input: AppleMobileCallbackInput = {
      idToken: identityToken,
      nonce,
      userName: givenName ?? undefined,
      deviceType: 'IOS',
    };
    return this.#saveTokens(await this.#publicHttpClient.post('v1/auth/apple/callback', input));
  };

  emailLogin = async (email: string, password: string) =>
    this.#saveTokens(
      await this.#publicHttpClient.post('v1/auth/login', {
        email,
        password,
        deviceType: process.env.EXPO_OS === 'ios' ? 'IOS' : 'ANDROID',
      }),
    );

  exchangeCode = async (request: ExchangeCodeInput) =>
    this.#saveTokens(await this.#publicHttpClient.post('v1/auth/exchange', request));

  /** 서버 세션만 끝낸다. 토큰 삭제는 응답을 기다린 사이 세션이 바뀌었는지 보는 `logOutDevice`가 정한다 */
  logout = async (config?: Pick<RequestConfig, 'timeout'>): Promise<Result<void, ApiError>> => {
    const result = await this.#authHttpClient.post('v1/auth/logout', undefined, config);
    return result.ok ? ok(undefined) : result;
  };

  /** 명시적 로그아웃/탈퇴 — 세션 만료(SessionManager.end)와 더불어 토큰을 지우는 유일한 경로. */
  clearLocalSession = (): Promise<void> => this.#tokenStore.clear();

  verifyEmail = async (input: VerifyEmailInput) =>
    this.#saveTokens(await this.#publicHttpClient.post('v1/auth/verify-email', input));

  register = async (input: RegisterInput) =>
    parseApiResponse(
      await this.#publicHttpClient.post('v1/auth/register', input),
      registerResponseSchema,
      toRegisterResult,
      '[AuthService] Invalid register response',
    );

  resendVerification = async (input: ResendVerificationInput) =>
    parseApiResponse(
      await this.#publicHttpClient.post('v1/auth/resend-verification', input),
      resendVerificationResponseSchema,
      toResendVerificationResult,
      '[AuthService] Invalid resendVerification response',
    );

  getLinkedAccounts = async (signal?: AbortSignal) =>
    parseApiResponse(
      await this.#authHttpClient.get('v1/auth/linked-accounts', { signal }),
      linkedAccountsResponseSchema,
      toLinkedAccounts,
      '[AuthService] Invalid getLinkedAccounts response',
    );

  openLinkOAuth = (provider: OAuthStartProvider, userHint?: string) =>
    this.#openOAuth(provider, 'link', userHint);

  linkAccount = async (
    provider: OAuthProviderSlug,
  ): Promise<Result<{ message: string }, AuthServiceError>> => {
    if (provider === 'apple') {
      return this.linkApple();
    }

    const oauthResult = await this.openLinkOAuth(provider);
    if (!oauthResult.ok) {
      return oauthResult;
    }

    return this.linkWithCode(oauthResult.value);
  };

  linkWithCode = async (code: string) =>
    parseApiResponse(
      await this.#authHttpClient.post('v1/auth/link-with-code', { code }),
      linkAccountResponseSchema,
      identity,
      '[AuthService] Invalid link response',
    );

  linkApple = async (): Promise<Result<{ message: string }, AuthServiceError>> => {
    const credential = await this.#signInWithApple();
    if (!credential.ok) {
      return credential;
    }

    const { identityToken, nonce } = credential.value;
    return parseApiResponse(
      await this.#authHttpClient.post('v1/auth/link', {
        provider: 'APPLE',
        idToken: identityToken,
        nonce,
      }),
      linkAccountResponseSchema,
      identity,
      '[AuthService] Invalid link response',
    );
  };

  unlinkAccount = async (provider: OAuthProvider) =>
    parseApiResponse(
      await this.#authHttpClient.delete(`v1/auth/linked-accounts/${provider}`),
      unlinkAccountResponseSchema,
      identity,
      '[AuthService] Invalid unlink response',
    );

  forgotPassword = async (input: ForgotPasswordInput) =>
    parseApiResponse(
      await this.#publicHttpClient.post('v1/auth/forgot-password', input),
      forgotPasswordResponseSchema,
      toForgotPasswordResult,
      '[AuthService] Invalid forgotPassword response',
    );

  resetPassword = async (input: ResetPasswordInput) =>
    parseApiResponse(
      await this.#publicHttpClient.post('v1/auth/reset-password', input),
      resetPasswordResponseSchema,
      toResetPasswordResult,
      '[AuthService] Invalid resetPassword response',
    );

  changePassword = async (input: ChangePasswordInput) =>
    parseApiResponse(
      await this.#authHttpClient.patch('v1/auth/password', input),
      changePasswordResponseSchema,
      toChangePasswordResult,
      '[AuthService] Invalid changePassword response',
    );

  deleteAccount = async (input: DeleteAccountInput) => {
    const result = parseApiResponse(
      await this.#authHttpClient.delete('v1/auth/account', { body: input }),
      deleteAccountResponseSchema,
      toDeleteAccountResult,
      '[AuthService] Invalid deleteAccount response',
    );
    if (result.ok) {
      await this.clearLocalSession();
    }
    return result;
  };
}
