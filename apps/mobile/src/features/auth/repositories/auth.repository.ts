import type {
  AuthTokens,
  ConsentResponse,
  CurrentUser,
  ExchangeCodeInput,
  PreferenceResponse,
  UpdateMarketingConsentInput,
  UpdateMarketingConsentResponse,
  UpdatePreferenceInput,
  UpdatePreferenceResponse,
} from '@aido/validators';

export interface AuthRepository {
  exchangeCode(request: ExchangeCodeInput): Promise<AuthTokens>;

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
}
