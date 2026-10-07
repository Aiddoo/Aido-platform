import type {
  AuthOAuthStateRecord,
  AuthOAuthStateRepositoryPort,
  ConsumeAuthOAuthStateInput,
} from "#api/modules/identity/application/ports/auth/auth-persistence.port";
import type {
  GenerateAuthUrlParams,
  OAuthIdentityProvider,
  SocialLoginOptions,
  VerifiedProfile,
} from "#api/modules/identity/application/ports/auth/oauth-identity-provider.port";
import type { AccountProvider } from "#api/modules/identity/domain/types/auth/auth.types";
import { OAuthStateFixture } from "#test/fixtures/oauth-state.fixture";

export class StubAuthOAuthStateRepository implements AuthOAuthStateRepositoryPort {
  readonly states: Map<number, AuthOAuthStateRecord>;
  #exchangeSequence = 0;

  constructor(states: readonly AuthOAuthStateRecord[] = []) {
    this.states = new Map(states.map((state) => [state.id, { ...state }]));
  }

  async create(
    state: string,
    provider: AccountProvider,
    redirectUri: string,
    options: Parameters<AuthOAuthStateRepositoryPort["create"]>[3] = {},
  ): Promise<AuthOAuthStateRecord> {
    const record = OAuthStateFixture.create({
      id: Math.max(0, ...this.states.keys()) + 1,
      state,
      provider,
      redirectUri,
      mode: options.mode ?? "login",
      initiatingUserId: options.initiatingUserId ?? null,
      expiresAt: new Date(Date.now() + (options.expiresInMinutes ?? 10) * 60_000),
    });
    this.states.set(record.id, record);
    return { ...record };
  }

  async findByState(state: string): Promise<AuthOAuthStateRecord | null> {
    const record = [...this.states.values()].find(
      (record) => record.state === state && record.expiresAt.getTime() > Date.now(),
    );
    return record === undefined ? null : { ...record };
  }

  async findByExchangeCode(code: string, at = new Date()): Promise<AuthOAuthStateRecord | null> {
    const record = [...this.states.values()].find(
      (record) =>
        record.exchangeCode === code && record.exchangedAt === null && record.expiresAt > at,
    );
    return record === undefined ? null : { ...record };
  }

  async saveExchangeData(
    id: number,
    data: Parameters<AuthOAuthStateRepositoryPort["saveExchangeData"]>[1],
  ): Promise<void> {
    const record = this.#requireState(id);
    this.states.set(id, {
      ...record,
      ...data,
      userName: data.userName ?? null,
      profileImage: data.profileImage ?? null,
      accountRestored: data.accountRestored ?? null,
    });
  }

  async saveLinkingData(
    id: number,
    data: Parameters<AuthOAuthStateRepositoryPort["saveLinkingData"]>[1],
  ): Promise<void> {
    this.states.set(id, {
      ...this.#requireState(id),
      exchangeCode: data.exchangeCode,
      provider: data.provider,
      userId: data.providerAccountId,
    });
  }

  async consumeExchangeCode(input: ConsumeAuthOAuthStateInput): Promise<boolean> {
    const record = this.states.get(input.id);
    if (
      record === undefined ||
      record.exchangeCode !== input.exchangeCode ||
      record.exchangedAt !== null ||
      record.expiresAt <= input.at ||
      (input.purpose === "link" &&
        (record.mode !== "link" ||
          (record.initiatingUserId !== null &&
            record.initiatingUserId !== "" &&
            record.initiatingUserId !== input.actorUserId)))
    )
      return false;
    this.states.set(input.id, {
      ...record,
      exchangedAt: new Date(input.at),
      accessToken: null,
      refreshToken: null,
    });
    return true;
  }

  generateExchangeCode(): string {
    return `exchange-code-${++this.#exchangeSequence}`;
  }

  #requireState(id: number): AuthOAuthStateRecord {
    const record = this.states.get(id);
    if (record === undefined) throw new Error(`OAuth state가 없습니다: ${id}`);
    return record;
  }
}

export class CountingOAuthIdentityProvider implements OAuthIdentityProvider {
  readonly failureEmail: string;
  readonly exchanges: { code: string; state: string | undefined }[] = [];
  readonly verifications: { token: string; nonce: string | undefined }[] = [];
  profile: VerifiedProfile;
  verificationError: Error | null = null;
  exchangeError: Error | null = null;
  exchangedToken: string | null = "provider-token";

  constructor(
    readonly provider: AccountProvider = "GOOGLE",
    profile: VerifiedProfile = {
      id: "provider-account",
      email: "social@example.com",
      emailVerified: true,
      name: "소셜 사용자",
      picture: "https://example.com/avatar.png",
    },
  ) {
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
    if (this.exchangeError !== null) throw this.exchangeError;
    return this.exchangedToken === null ? null : { token: this.exchangedToken };
  }

  async verifyToken(token: string, nonce?: string): Promise<VerifiedProfile> {
    this.verifications.push({ token, nonce });
    if (this.verificationError !== null) throw this.verificationError;
    return { ...this.profile };
  }

  buildLoginOptions(profile: VerifiedProfile, userName?: string): SocialLoginOptions {
    return {
      userName: this.provider === "APPLE" ? userName : (userName ?? profile.name),
      emailVerified: profile.emailVerified,
      profileImage: this.provider === "APPLE" ? undefined : profile.picture,
    };
  }
}
