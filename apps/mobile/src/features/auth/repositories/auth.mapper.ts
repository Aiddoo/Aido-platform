import type {
  AuthTokens as AuthTokensDTO,
  ConsentResponse,
  CurrentUser,
  LinkedAccount as LinkedAccountDTO,
  LinkedAccountsResponse,
  PreferenceResponse,
  RegisterResponse,
  ResendVerificationResponse,
  UpdateMarketingConsentResponse,
} from '@aido/validators';
import type {
  AuthTokens,
  Consent,
  LinkedAccount,
  Preference,
  RegisterResult,
  ResendVerificationResult,
  UpdateMarketingConsentResult,
  User,
} from '../models/auth.model';
import { AuthPolicy } from '../models/auth.model';

export const toAuthTokens = (dto: AuthTokensDTO): AuthTokens => ({
  userId: dto.userId,
  accessToken: dto.accessToken,
  refreshToken: dto.refreshToken,
  userName: dto.name,
  userProfileImage: dto.profileImage,
});

export const toUser = (dto: CurrentUser): User => ({
  id: dto.userId,
  email: dto.email,
  name: dto.name,
  profileImage: dto.profileImage,
  userTag: dto.userTag,
  subscriptionStatus: dto.subscriptionStatus,
  createdAt: new Date(dto.createdAt),
  isSubscribed: AuthPolicy.isPremiumUser(dto.subscriptionStatus),
});

export const toPreference = (dto: PreferenceResponse): Preference => ({
  pushEnabled: dto.pushEnabled,
  nightPushEnabled: dto.nightPushEnabled,
});

export const toConsent = (dto: ConsentResponse): Consent => ({
  termsAgreedAt: dto.termsAgreedAt ? new Date(dto.termsAgreedAt) : null,
  privacyAgreedAt: dto.privacyAgreedAt ? new Date(dto.privacyAgreedAt) : null,
  agreedTermsVersion: dto.agreedTermsVersion,
  marketingAgreedAt: dto.marketingAgreedAt ? new Date(dto.marketingAgreedAt) : null,
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

export const toLinkedAccount = (dto: LinkedAccountDTO): LinkedAccount => ({
  provider: dto.provider,
  linked: dto.linked,
  providerAccountId: dto.providerAccountId,
  linkedAt: dto.linkedAt ? new Date(dto.linkedAt) : null,
});

export const toLinkedAccounts = (dto: LinkedAccountsResponse): LinkedAccount[] =>
  dto.accounts.map(toLinkedAccount);
