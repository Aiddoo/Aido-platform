import {
  type AppleMobileCallbackInput,
  type ChangePasswordInput,
  changePasswordResponseSchema,
  type DeleteAccountInput,
  deleteAccountResponseSchema,
  type ExchangeCodeInput,
  type ForgotPasswordInput,
  forgotPasswordResponseSchema,
  type LinkSocialAccountInput,
  linkAccountResponseSchema,
  linkedAccountsResponseSchema,
  type LoginInput,
  type RegisterInput,
  type ResendVerificationInput,
  resendVerificationResponseSchema,
  type ResetPasswordInput,
  resetPasswordResponseSchema,
  unlinkAccountResponseSchema,
  type VerifyEmailInput,
} from '@aido/api';
import type { ApiError } from '@src/core/errors/api-error';
import { ok, type Result } from '@src/core/errors/result';
import type { HttpClient, RequestConfig } from '@src/core/ports/http-client';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';
import { identity } from 'es-toolkit';

import { type OAuthProvider } from '../domains/oauth.model';
import { authTokensEnvelopeSchema, registerEnvelopeSchema } from '../schemas/auth-response.schema';
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

interface AuthApiClients {
  /** 로그인 전에도 부르는 요청과 지난 계정의 토큰으로 보내는 해제 요청 */
  publicHttpClient: HttpClient;
  authHttpClient: HttpClient;
}

/** 토큰 저장과 소셜 인증 창은 `SignInService`가 맡는다. 여기서는 요청과 응답 변환만 한다 */
export class AuthApi {
  readonly #publicHttpClient: HttpClient;
  readonly #authHttpClient: HttpClient;

  constructor({ publicHttpClient, authHttpClient }: AuthApiClients) {
    this.#publicHttpClient = publicHttpClient;
    this.#authHttpClient = authHttpClient;
  }

  login = async (input: LoginInput) =>
    parseApiResponse(
      await this.#publicHttpClient.post('v1/auth/login', input),
      authTokensEnvelopeSchema,
      toAuthTokens,
      '[AuthApi] Invalid login response',
    );

  signInWithApple = async (input: AppleMobileCallbackInput) =>
    parseApiResponse(
      await this.#publicHttpClient.post('v1/auth/apple/callback', input),
      authTokensEnvelopeSchema,
      toAuthTokens,
      '[AuthApi] Invalid signInWithApple response',
    );

  exchangeCode = async (input: ExchangeCodeInput) =>
    parseApiResponse(
      await this.#publicHttpClient.post('v1/auth/exchange', input),
      authTokensEnvelopeSchema,
      toAuthTokens,
      '[AuthApi] Invalid exchangeCode response',
    );

  verifyEmail = async (input: VerifyEmailInput) =>
    parseApiResponse(
      await this.#publicHttpClient.post('v1/auth/verify-email', input),
      authTokensEnvelopeSchema,
      toAuthTokens,
      '[AuthApi] Invalid verifyEmail response',
    );

  register = async (input: RegisterInput) =>
    parseApiResponse(
      await this.#publicHttpClient.post('v1/auth/register', input),
      registerEnvelopeSchema,
      toRegisterResult,
      '[AuthApi] Invalid register response',
    );

  resendVerification = async (input: ResendVerificationInput) =>
    parseApiResponse(
      await this.#publicHttpClient.post('v1/auth/resend-verification', input),
      resendVerificationResponseSchema,
      toResendVerificationResult,
      '[AuthApi] Invalid resendVerification response',
    );

  forgotPassword = async (input: ForgotPasswordInput) =>
    parseApiResponse(
      await this.#publicHttpClient.post('v1/auth/forgot-password', input),
      forgotPasswordResponseSchema,
      toForgotPasswordResult,
      '[AuthApi] Invalid forgotPassword response',
    );

  resetPassword = async (input: ResetPasswordInput) =>
    parseApiResponse(
      await this.#publicHttpClient.post('v1/auth/reset-password', input),
      resetPasswordResponseSchema,
      toResetPasswordResult,
      '[AuthApi] Invalid resetPassword response',
    );

  changePassword = async (input: ChangePasswordInput) =>
    parseApiResponse(
      await this.#authHttpClient.patch('v1/auth/password', input),
      changePasswordResponseSchema,
      toChangePasswordResult,
      '[AuthApi] Invalid changePassword response',
    );

  deleteAccount = async (input: DeleteAccountInput) =>
    parseApiResponse(
      await this.#authHttpClient.delete('v1/auth/account', { body: input }),
      deleteAccountResponseSchema,
      toDeleteAccountResult,
      '[AuthApi] Invalid deleteAccount response',
    );

  getLinkedAccounts = async (signal?: AbortSignal) =>
    parseApiResponse(
      await this.#authHttpClient.get('v1/auth/linked-accounts', { signal }),
      linkedAccountsResponseSchema,
      toLinkedAccounts,
      '[AuthApi] Invalid getLinkedAccounts response',
    );

  linkWithCode = async (code: string) =>
    parseApiResponse(
      await this.#authHttpClient.post('v1/auth/link-with-code', { code }),
      linkAccountResponseSchema,
      identity,
      '[AuthApi] Invalid linkWithCode response',
    );

  linkWithIdToken = async (input: LinkSocialAccountInput) =>
    parseApiResponse(
      await this.#authHttpClient.post('v1/auth/link', input),
      linkAccountResponseSchema,
      identity,
      '[AuthApi] Invalid linkWithIdToken response',
    );

  unlinkAccount = async (provider: OAuthProvider) =>
    parseApiResponse(
      await this.#authHttpClient.delete(`v1/auth/linked-accounts/${provider}`),
      unlinkAccountResponseSchema,
      identity,
      '[AuthApi] Invalid unlinkAccount response',
    );

  /** 서버 세션만 끝낸다. 토큰 삭제는 응답을 기다린 사이 세션이 바뀌었는지 보는 `LogOutDeviceService`가 정한다 */
  logout = async (config?: Pick<RequestConfig, 'timeout'>): Promise<Result<void, ApiError>> => {
    const result = await this.#authHttpClient.post('v1/auth/logout', undefined, config);
    return result.ok ? ok(undefined) : result;
  };

  /** 지난 계정의 토큰으로 서버 세션을 끝낸다. 인증 클라이언트는 401에 지금 세션을 끝내 지금 계정을 로그아웃시키므로 공개 클라이언트로 보낸다 */
  revokeSession = async (
    accessToken: string,
    config?: Pick<RequestConfig, 'timeout'>,
  ): Promise<Result<void, ApiError>> => {
    const result = await this.#publicHttpClient.post('v1/auth/logout', undefined, {
      ...config,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return result.ok ? ok(undefined) : result;
  };
}
