import type {
  AuthTokens as AuthTokensDTO,
  ChangePasswordResponse,
  ConsentResponse,
  DeleteAccountResponse,
  ForgotPasswordResponse,
  LinkedAccount as LinkedAccountDTO,
  LinkedAccountsResponse,
  RegisterResponse,
  ResendVerificationResponse,
  ResetPasswordResponse,
  UpdateMarketingConsentResponse,
  UpdateMarketingPushConsentResponse,
} from '@aido/api';

import type {
  AuthTokens,
  ChangePasswordResult,
  Consent,
  DeleteAccountResult,
  ForgotPasswordResult,
  RegisterResult,
  ResendVerificationResult,
  ResetPasswordResult,
  UpdateMarketingConsentResult,
  UpdateMarketingPushConsentResult,
} from '../domains/auth.model';
import type { LinkedAccount, LinkedAccountsResult } from '../domains/oauth.model';

export const toAuthTokens = (dto: AuthTokensDTO): AuthTokens => ({
  userId: dto.userId,
  accessToken: dto.accessToken,
  refreshToken: dto.refreshToken,
  userName: dto.name,
  userProfileImage: dto.profileImage,
  accountRestored: dto.accountRestored ?? false,
});

export const toConsent = (dto: ConsentResponse): Consent => ({
  termsAgreedAt: dto.termsAgreedAt ? new Date(dto.termsAgreedAt) : null,
  privacyAgreedAt: dto.privacyAgreedAt ? new Date(dto.privacyAgreedAt) : null,
  agreedTermsVersion: dto.agreedTermsVersion,
  marketingAgreedAt: dto.marketingAgreedAt ? new Date(dto.marketingAgreedAt) : null,
  marketingPushAgreedAt: dto.marketingPushAgreedAt ? new Date(dto.marketingPushAgreedAt) : null,
});

export const toRegisterResult = (dto: RegisterResponse): RegisterResult => ({
  message: dto.message,
  email: dto.email,
});

export const toResendVerificationResult = (
  dto: ResendVerificationResponse,
): ResendVerificationResult => ({
  message: dto.message,
  email: dto.email,
  retryAfterSeconds: dto.retryAfterSeconds,
});

export const toUpdateMarketingConsentResult = (
  dto: UpdateMarketingConsentResponse,
): UpdateMarketingConsentResult => ({
  marketingAgreedAt: dto.marketingAgreedAt ? new Date(dto.marketingAgreedAt) : null,
});

export const toUpdateMarketingPushConsentResult = (
  dto: UpdateMarketingPushConsentResponse,
): UpdateMarketingPushConsentResult => ({
  marketingPushAgreedAt: dto.marketingPushAgreedAt ? new Date(dto.marketingPushAgreedAt) : null,
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
