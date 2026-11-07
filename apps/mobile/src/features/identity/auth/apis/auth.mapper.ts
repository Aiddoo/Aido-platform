import type {
  AuthTokens as AuthTokensDto,
  ChangePasswordResponse,
  DeleteAccountResponse,
  ForgotPasswordResponse,
  LinkedAccount as LinkedAccountDto,
  LinkedAccountsResponse,
  RegisterResponse,
  ResendVerificationResponse,
  ResetPasswordResponse,
} from '@aido/api';
import { toInstant } from '@src/shared/date/instant';

import type {
  AuthTokens,
  ChangePasswordResult,
  DeleteAccountResult,
  ForgotPasswordResult,
  RegisterResult,
  ResendVerificationResult,
  ResetPasswordResult,
} from '../schemas/auth.schema';
import type { LinkedAccount, LinkedAccountsResult } from '../schemas/oauth.schema';

export function toAuthTokens(dto: AuthTokensDto): AuthTokens {
  return {
    userId: dto.userId,
    accessToken: dto.accessToken,
    refreshToken: dto.refreshToken,
    userName: dto.name,
    userProfileImage: dto.profileImage,
    accountRestored: dto.accountRestored ?? false,
    isNewUser: dto.isNewUser ?? false,
  };
}

export function toRegisterResult(dto: RegisterResponse): RegisterResult {
  return {
    message: dto.message,
    email: dto.email,
    // 구 서버 응답에는 없다. 그때는 예전처럼 보냈다고 본다
    isEmailSent: dto.emailSent ?? true,
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
    linkedAt: dto.linkedAt ? toInstant(dto.linkedAt) : null,
  };
}

export function toLinkedAccounts(dto: LinkedAccountsResponse): LinkedAccountsResult {
  return {
    accounts: dto.accounts.map(toLinkedAccount),
    canUnlink: dto.canUnlink,
  };
}
