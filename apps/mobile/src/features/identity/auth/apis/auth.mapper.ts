import type {
  AuthTokens as AuthTokensDTO,
  ChangePasswordResponse,
  DeleteAccountResponse,
  ForgotPasswordResponse,
  LinkedAccount as LinkedAccountDTO,
  LinkedAccountsResponse,
  RegisterResponse,
  ResendVerificationResponse,
  ResetPasswordResponse,
} from '@aido/api';

import type {
  AuthTokens,
  ChangePasswordResult,
  DeleteAccountResult,
  ForgotPasswordResult,
  RegisterResult,
  ResendVerificationResult,
  ResetPasswordResult,
} from '../domains/auth.model';
import type { LinkedAccount, LinkedAccountsResult } from '../domains/oauth.model';

export const toAuthTokens = (dto: AuthTokensDTO): AuthTokens => ({
  userId: dto.userId,
  accessToken: dto.accessToken,
  refreshToken: dto.refreshToken,
  userName: dto.name,
  userProfileImage: dto.profileImage,
  accountRestored: dto.accountRestored ?? false,
  isNewUser: dto.isNewUser ?? false,
});

export const toRegisterResult = (dto: RegisterResponse): RegisterResult => ({
  message: dto.message,
  email: dto.email,
  // 구 서버 응답에는 없다. 그때는 예전처럼 보냈다고 본다
  isEmailSent: dto.emailSent ?? true,
});

export const toResendVerificationResult = (
  dto: ResendVerificationResponse,
): ResendVerificationResult => ({
  message: dto.message,
  email: dto.email,
  retryAfterSeconds: dto.retryAfterSeconds,
});

export const toDeleteAccountResult = (dto: DeleteAccountResponse): DeleteAccountResult => ({
  message: dto.message,
  deletedAt: new Date(dto.deletedAt),
  gracePeriodDays: dto.gracePeriodDays,
});

export const toForgotPasswordResult = (dto: ForgotPasswordResponse): ForgotPasswordResult => ({
  message: dto.message,
});

export const toResetPasswordResult = (dto: ResetPasswordResponse): ResetPasswordResult => ({
  message: dto.message,
});

export const toChangePasswordResult = (dto: ChangePasswordResponse): ChangePasswordResult => ({
  message: dto.message,
});

export const toLinkedAccount = (dto: LinkedAccountDTO): LinkedAccount => ({
  provider: dto.provider,
  linked: dto.linked,
  providerAccountId: dto.providerAccountId,
  linkedAt: dto.linkedAt ? new Date(dto.linkedAt) : null,
});

export const toLinkedAccounts = (dto: LinkedAccountsResponse): LinkedAccountsResult => ({
  accounts: dto.accounts.map(toLinkedAccount),
  canUnlink: dto.canUnlink,
});
