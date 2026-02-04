import type {
  AppleMobileCallbackInput,
  AuthTokens,
  ConsentResponse,
  CurrentUser,
  ExchangeCodeInput,
  PreferenceResponse,
  RegisterInput,
  RegisterResponse,
  ResendVerificationInput,
  ResendVerificationResponse,
  UpdateMarketingConsentInput,
  UpdateMarketingConsentResponse,
  UpdatePreferenceInput,
  UpdatePreferenceResponse,
  VerifyEmailInput,
} from '@aido/validators';

export interface AuthRepository {
  exchangeCode(request: ExchangeCodeInput): Promise<AuthTokens>;

  emailLogin(email: string, password: string): Promise<AuthTokens>;

  getCurrentUser(): Promise<CurrentUser>;

  logout(): Promise<void>;

  getKakaoAuthUrl(redirectUri: string): string;

  getNaverAuthUrl(redirectUri: string): string;

  getGoogleAuthUrl(redirectUri: string): string;

  getPreference(): Promise<PreferenceResponse>;

  updatePreference(input: UpdatePreferenceInput): Promise<UpdatePreferenceResponse>;

  getConsent(): Promise<ConsentResponse>;

  updateMarketingConsent(
    input: UpdateMarketingConsentInput,
  ): Promise<UpdateMarketingConsentResponse>;

  appleLogin(input: AppleMobileCallbackInput): Promise<AuthTokens>;

  register(input: RegisterInput): Promise<RegisterResponse>;

  verifyEmail(input: VerifyEmailInput): Promise<AuthTokens>;

  resendVerification(input: ResendVerificationInput): Promise<ResendVerificationResponse>;
}
