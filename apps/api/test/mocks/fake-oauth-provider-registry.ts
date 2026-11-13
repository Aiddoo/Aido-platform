import { invalidCredentials } from "#api/modules/identity/auth/application/auth.errors";
import {
  type ExchangedToken,
  type GenerateAuthUrlParams,
  OAuthIdentityProviderPort,
  OAuthIdentityProviderRegistryPort,
  type SocialLoginOptions,
  type VerifiedProfile,
} from "#api/modules/identity/auth/application/ports/oauth-identity-provider.port";
import type { AccountProvider } from "#api/modules/identity/auth/domain/auth.constants";

export type OAuthIdentityProviders = ReadonlyMap<AccountProvider, OAuthIdentityProviderPort>;

/** 공급자 토큰 검증을 대신하는 테스트 대역. 없으면 실제 어댑터의 검증을 쓴다 */
export interface OAuthTokenVerification {
  verify(provider: AccountProvider, token: string, nonce?: string): Promise<VerifiedProfile>;
}

function exchangeKey(provider: AccountProvider, code: string): string {
  return `${provider}:${code}`;
}

class FakeOAuthIdentityProvider extends OAuthIdentityProviderPort {
  readonly provider: AccountProvider;
  readonly failureEmail: string;
  readonly #delegate: OAuthIdentityProviderPort;
  readonly #exchange: (provider: AccountProvider, code: string) => Promise<ExchangedToken>;
  readonly #verification: OAuthTokenVerification | undefined;

  constructor(
    delegate: OAuthIdentityProviderPort,
    exchange: (provider: AccountProvider, code: string) => Promise<ExchangedToken>,
    verification: OAuthTokenVerification | undefined,
  ) {
    super();
    this.provider = delegate.provider;
    this.failureEmail = delegate.failureEmail;
    this.#delegate = delegate;
    this.#exchange = exchange;
    this.#verification = verification;
  }

  generateAuthUrl(params: GenerateAuthUrlParams): Promise<string | null> {
    return this.#delegate.generateAuthUrl(params);
  }

  exchangeCode(code: string): Promise<ExchangedToken> {
    return this.#exchange(this.provider, code);
  }

  verifyToken(token: string, nonce?: string): Promise<VerifiedProfile> {
    return this.#verification == null
      ? this.#delegate.verifyToken(token, nonce)
      : this.#verification.verify(this.provider, token, nonce);
  }

  buildLoginOptions(verifiedProfile: VerifiedProfile, userName?: string): SocialLoginOptions {
    return this.#delegate.buildLoginOptions(verifiedProfile, userName);
  }
}

class FakeOAuthIdentityProviderRegistry extends OAuthIdentityProviderRegistryPort {
  readonly #providers: OAuthIdentityProviders;

  constructor(providers: OAuthIdentityProviders) {
    super();
    this.#providers = providers;
  }

  get(provider: AccountProvider): OAuthIdentityProviderPort | undefined {
    return this.#providers.get(provider);
  }
}

export class FakeOAuthProviderRegistry {
  readonly registry: OAuthIdentityProviderRegistryPort;
  readonly #exchangeTokens = new Map<string, string>();
  readonly #exchangeFailures = new Map<string, Error>();

  constructor(delegates: OAuthIdentityProviders, verification?: OAuthTokenVerification) {
    this.registry = new FakeOAuthIdentityProviderRegistry(
      new Map(
        [...delegates].map(([provider, delegate]) => [
          provider,
          new FakeOAuthIdentityProvider(
            delegate,
            (currentProvider, code) => this.#exchangeCode(currentProvider, code),
            verification,
          ),
        ]),
      ),
    );
  }

  setExchangeToken(provider: AccountProvider, code: string, token: string): void {
    const key = exchangeKey(provider, code);
    this.#exchangeFailures.delete(key);
    this.#exchangeTokens.set(key, token);
  }

  simulateExchangeFailure(
    provider: AccountProvider,
    code: string,
    error: Error = invalidCredentials(),
  ): void {
    const key = exchangeKey(provider, code);
    this.#exchangeTokens.delete(key);
    this.#exchangeFailures.set(key, error);
  }

  clear(): void {
    this.#exchangeTokens.clear();
    this.#exchangeFailures.clear();
  }

  async #exchangeCode(provider: AccountProvider, code: string): Promise<ExchangedToken> {
    const key = exchangeKey(provider, code);
    const failure = this.#exchangeFailures.get(key);
    if (failure) {
      throw failure;
    }

    if (code.startsWith("invalid")) {
      throw invalidCredentials();
    }

    return {
      token: this.#exchangeTokens.get(key) ?? `fake-${provider.toLowerCase()}-${code}`,
    };
  }
}
