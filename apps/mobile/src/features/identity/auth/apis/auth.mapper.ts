import type {
  AppleMobileCallbackInput,
  ChangePasswordResponse,
  DeleteAccountResponse,
  ForgotPasswordResponse,
  LinkedAccount as LinkedAccountDto,
  LinkedAccountsResponse,
  LinkSocialAccountInput,
  LoginInput,
  ResendVerificationResponse,
  ResetPasswordResponse,
} from '@aido/api';
import type { AppleSignInResult } from '@src/core/ports/social-auth-gateway';
import { toInstant, toNullableInstant } from '@src/shared/date/instant';

import {
  type AuthTokens,
  type ChangePasswordResult,
  type DeleteAccountResult,
  type ForgotPasswordResult,
  type RegisterResult,
  type ResendVerificationResult,
  type ResetPasswordResult,
} from '../domains/auth.model';
import { type LinkedAccount, type LinkedAccountsResult } from '../domains/oauth.model';
import { type AuthTokensEnvelope, type RegisterEnvelope } from '../schemas/auth-response.schema';

type AppleCredential = Extract<AppleSignInResult, { type: 'success' }>;
type SessionDeviceType = NonNullable<LoginInput['deviceType']>;

export function toEmailLoginRequest(
  { email, password }: Pick<LoginInput, 'email' | 'password'>,
  deviceType: SessionDeviceType,
): LoginInput {
  return { email, password, deviceType };
}

/** Apple은 이름을 처음 로그인에만 준다. 없으면 보내지 않는다 */
export function toAppleSignInRequest(
  { identityToken, nonce, givenName }: AppleCredential,
  deviceType: SessionDeviceType,
): AppleMobileCallbackInput {
  return { idToken: identityToken, nonce, userName: givenName ?? undefined, deviceType };
}

export function toAppleLinkRequest({
  identityToken,
  nonce,
}: AppleCredential): LinkSocialAccountInput {
  return { provider: 'APPLE', idToken: identityToken, nonce };
}

export function toAuthTokens(dto: AuthTokensEnvelope): AuthTokens {
  return {
    userId: dto.userId,
    accessToken: dto.accessToken,
    refreshToken: dto.refreshToken,
    userName: dto.name,
    userProfileImage: dto.profileImage,
    accountRestored: dto.accountRestored,
    isNewUser: dto.isNewUser ?? false,
  };
}

export function toRegisterResult(dto: RegisterEnvelope): RegisterResult {
  return {
    message: dto.message,
    email: dto.email,
    isEmailSent: dto.emailSent,
  };
}

export function toResendVerificationResult(
  dto: ResendVerificationResponse,
): ResendVerificationResult {
  return {
    message: dto.message,
    email: dto.email,
    retryAfterSeconds: dto.retryAfterSeconds,
  };
}

export function toDeleteAccountResult(dto: DeleteAccountResponse): DeleteAccountResult {
  return {
    message: dto.message,
    deletedAt: toInstant(dto.deletedAt),
    gracePeriodDays: dto.gracePeriodDays,
  };
}

export function toForgotPasswordResult(dto: ForgotPasswordResponse): ForgotPasswordResult {
  return {
    message: dto.message,
  };
}

export function toResetPasswordResult(dto: ResetPasswordResponse): ResetPasswordResult {
  return {
    message: dto.message,
  };
}

export function toChangePasswordResult(dto: ChangePasswordResponse): ChangePasswordResult {
  return {
    message: dto.message,
  };
}

export function toLinkedAccount(dto: LinkedAccountDto): LinkedAccount {
  return {
    provider: dto.provider,
    linked: dto.linked,
    providerAccountId: dto.providerAccountId,
    linkedAt: toNullableInstant(dto.linkedAt),
  };
}

export function toLinkedAccounts(dto: LinkedAccountsResponse): LinkedAccountsResult {
  return {
    accounts: dto.accounts.map(toLinkedAccount),
    canUnlink: dto.canUnlink,
  };
}
