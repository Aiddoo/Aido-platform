import type {
  GenerateAuthUrlParams,
  OAuthIdentityProviderPort,
  SocialLoginOptions,
  VerifiedProfile,
} from "#api/modules/identity/linked-accounts/application/ports/oauth-identity-provider.port";
import type { AccountProvider } from "#api/modules/identity/linked-accounts/domain/linked-accounts.constants";
import { ProviderAccountId } from "#api/modules/identity/linked-accounts/domain/provider-account-id.vo";

// 테스트는 공급자 계정 ID를 문자열로 적고, 포트로 돌려줄 때 VO로 바꾼다
export type TestVerifiedProfile = Omit<VerifiedProfile, "id"> & { readonly id: string };

export function toVerifiedProfile(profile: TestVerifiedProfile): VerifiedProfile {
  return { ...profile, id: ProviderAccountId.reconstitute(profile.id) };
}

export class CountingOAuthIdentityProvider implements OAuthIdentityProviderPort {
  readonly failureEmail: string;
  readonly exchanges: { code: string; state: string | undefined }[] = [];
  readonly verifications: { token: string; nonce: string | undefined }[] = [];
  profile: TestVerifiedProfile;
  verificationError: Error | null = null;
  exchangeError: Error | null = null;
  exchangedToken: string | null = "provider-token";

  readonly provider: AccountProvider;

  constructor(
    provider: AccountProvider = "GOOGLE",
    profile: TestVerifiedProfile = {
      id: "provider-account",
      email: "social@example.com",
      emailVerified: true,
      name: "소셜 사용자",
      picture: "https://example.com/avatar.png",
    },
  ) {
    this.provider = provider;
    this.failureEmail = `${provider.toLowerCase()}@oauth.failed`;
    this.profile = { ...profile };
  }

  async generateAuthUrl(input: GenerateAuthUrlParams): Promise<string | null> {
    await input.persistState(this.provider, input.validatedRedirectUri, {
      mode: input.mode,
      initiatingUserId: input.initiatingUserId,
    });
    return `https://provider.example/authorize?state=${input.state}`;
  }

  async exchangeCode(code: string, state?: string) {
    this.exchanges.push({ code, state });
    if (this.exchangeError !== null) {
      throw this.exchangeError;
    }
    return this.exchangedToken === null ? null : { token: this.exchangedToken };
  }

  async verifyToken(token: string, nonce?: string): Promise<VerifiedProfile> {
    this.verifications.push({ token, nonce });
    if (this.verificationError !== null) {
      throw this.verificationError;
    }
    return toVerifiedProfile(this.profile);
  }

  buildLoginOptions(profile: VerifiedProfile, userName?: string): SocialLoginOptions {
    return {
      userName: this.provider === "APPLE" ? userName : (userName ?? profile.name),
      emailVerified: profile.emailVerified,
      profileImage: this.provider === "APPLE" ? undefined : profile.picture,
    };
  }
}
