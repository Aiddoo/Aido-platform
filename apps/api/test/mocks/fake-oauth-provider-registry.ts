import { ErrorCode } from "@aido/errors";

import type {
	ExchangedToken,
	GenerateAuthUrlParams,
	OAuthIdentityProvider,
	OAuthIdentityProviderRegistry,
	SocialLoginOptions,
	VerifiedProfile,
} from "@/auth/application/ports/oauth-identity-provider.port";
import type { AccountProvider } from "@/auth/domain/types";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

function exchangeKey(provider: AccountProvider, code: string): string {
	return `${provider}:${code}`;
}

class FakeOAuthIdentityProvider implements OAuthIdentityProvider {
	readonly provider: AccountProvider;
	readonly failureEmail: string;

	constructor(
		private readonly delegate: OAuthIdentityProvider,
		private readonly exchange: (provider: AccountProvider, code: string) => Promise<ExchangedToken>,
	) {
		this.provider = delegate.provider;
		this.failureEmail = delegate.failureEmail;
	}

	generateAuthUrl(params: GenerateAuthUrlParams): Promise<string | null> {
		return this.delegate.generateAuthUrl(params);
	}

	exchangeCode(code: string): Promise<ExchangedToken> {
		return this.exchange(this.provider, code);
	}

	verifyToken(token: string, nonce?: string): Promise<VerifiedProfile> {
		return this.delegate.verifyToken(token, nonce);
	}

	buildLoginOptions(verifiedProfile: VerifiedProfile, userName?: string): SocialLoginOptions {
		return this.delegate.buildLoginOptions(verifiedProfile, userName);
	}
}

export class FakeOAuthProviderRegistry {
	readonly registry: OAuthIdentityProviderRegistry;
	readonly #exchangeTokens = new Map<string, string>();
	readonly #exchangeFailures = new Map<string, Error>();

	constructor(delegates: OAuthIdentityProviderRegistry) {
		this.registry = new Map(
			[...delegates].map(([provider, delegate]) => [
				provider,
				new FakeOAuthIdentityProvider(delegate, (currentProvider, code) =>
					this.#exchangeCode(currentProvider, code),
				),
			]),
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
		error: Error = new ApplicationException(ErrorCode.USER_0602),
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
		if (failure) throw failure;

		if (code.startsWith("invalid")) {
			throw new ApplicationException(ErrorCode.USER_0602);
		}

		return {
			token: this.#exchangeTokens.get(key) ?? `fake-${provider.toLowerCase()}-${code}`,
		};
	}
}
