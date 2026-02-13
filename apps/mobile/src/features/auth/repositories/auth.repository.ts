import type {
  AppleMobileCallbackInput,
  ExchangeCodeInput,
  RegisterInput,
  ResendVerificationInput,
  UpdateMarketingConsentInput,
  UpdatePreferenceInput,
  VerifyEmailInput,
} from '@aido/validators';
import type { ApiError } from '@src/shared/errors/api-error';
import type { Result } from '@src/shared/errors/result';

import type {
  AuthTokens,
  Consent,
  LinkedAccount,
  OAuthProvider,
  OAuthStartMode,
  OAuthStartProvider,
  Preference,
  RegisterResult,
  ResendVerificationResult,
  UpdateMarketingConsentResult,
  User,
} from '../models/auth.model';

export interface AuthRepository {
  // 인증
  exchangeCode(request: ExchangeCodeInput): Promise<Result<AuthTokens, ApiError>>;
  emailLogin(email: string, password: string): Promise<Result<AuthTokens, ApiError>>;
  appleLogin(input: AppleMobileCallbackInput): Promise<Result<AuthTokens, ApiError>>;
  logout(): Promise<Result<void, ApiError>>;

  // 사용자 정보
  getCurrentUser(): Promise<Result<User, ApiError>>;

  // 설정
  getPreference(): Promise<Result<Preference, ApiError>>;
  updatePreference(input: UpdatePreferenceInput): Promise<Result<Preference, ApiError>>;

  // 동의
  getConsent(): Promise<Result<Consent, ApiError>>;
  updateMarketingConsent(
    input: UpdateMarketingConsentInput,
  ): Promise<Result<UpdateMarketingConsentResult, ApiError>>;

  // 회원가입
  register(input: RegisterInput): Promise<Result<RegisterResult, ApiError>>;
  verifyEmail(input: VerifyEmailInput): Promise<Result<AuthTokens, ApiError>>;
  resendVerification(
    input: ResendVerificationInput,
  ): Promise<Result<ResendVerificationResult, ApiError>>;

  // OAuth URL 생성 (동기 메서드)
  getOAuthWebStartUrl(
    provider: OAuthStartProvider,
    redirectUri: string,
    mode: OAuthStartMode,
    userHint?: string,
  ): string;

  // 소셜 계정 연동
  getLinkedAccounts(): Promise<Result<LinkedAccount[], ApiError>>;
  linkWithCode(code: string): Promise<Result<{ message: string }, ApiError>>;
  linkApple(idToken: string, nonce?: string): Promise<Result<{ message: string }, ApiError>>;
  unlinkAccount(provider: OAuthProvider): Promise<Result<{ message: string }, ApiError>>;
}
