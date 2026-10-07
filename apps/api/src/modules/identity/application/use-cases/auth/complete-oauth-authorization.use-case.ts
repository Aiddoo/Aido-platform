import { ErrorCode } from "@aido/api/errors";
import type { OAUTH_PROVIDERS } from "@aido/api/vocabulary";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { IdentityLogEvent } from "../../observability/auth/identity-log.events.js";
import type { AuthOAuthStateRepositoryPort } from "../../ports/auth/auth-persistence.port.js";
import type { OAuthIdentityProviderRegistry } from "../../ports/auth/oauth-identity-provider.port.js";
import type { RequestMetadata } from "../../types/auth/index.js";
import type { LoginWithOAuthToken } from "./login-with-oauth-token.use-case.js";

export interface CompleteOAuthAuthorizationInput {
  readonly provider: Exclude<(typeof OAUTH_PROVIDERS)[number], "APPLE">;
  readonly code: string;
  readonly state: string;
  readonly metadata?: RequestMetadata;
}

export interface CompleteOAuthAuthorizationResult {
  exchangeCode: string;
  redirectUri: string;
  userId: string;
  name?: string;
  profileImage?: string;
}

interface CompleteOAuthAuthorizationDependencies {
  readonly registry: OAuthIdentityProviderRegistry;
  readonly oauthStateRepository: Pick<
    AuthOAuthStateRepositoryPort,
    "findByState" | "generateExchangeCode" | "saveExchangeData" | "saveLinkingData"
  >;
  readonly loginWithOAuthToken: Pick<LoginWithOAuthToken, "execute">;
  readonly logger: ApplicationLogger;
}

export class CompleteOAuthAuthorization {
  readonly #dependencies: CompleteOAuthAuthorizationDependencies;

  constructor(dependencies: CompleteOAuthAuthorizationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: CompleteOAuthAuthorizationInput): Promise<CompleteOAuthAuthorizationResult> {
    const { provider, code, state, metadata } = input;
    const strategy = this.#dependencies.registry.get(provider);
    if (strategy === undefined)
      throw new ApplicationException(ErrorCode.SOCIAL_0204, {
        provider,
        reason: `Unsupported provider: ${provider}`,
      });
    const authorization = await this.#dependencies.oauthStateRepository.findByState(state);
    if (authorization === null) {
      this.#dependencies.logger.warn({ event: IdentityLogEvent.OAUTH_STATE_REJECTED });
      throw new ApplicationException(ErrorCode.USER_0602);
    }
    const redirectUri =
      authorization.redirectUri === "" ? "aido://auth/callback" : authorization.redirectUri;
    const exchanged = await strategy.exchangeCode(code, state);
    if (exchanged === null) throw new ApplicationException(ErrorCode.USER_0602);
    if (authorization.mode === "link") {
      const profile = await strategy.verifyToken(exchanged.token);
      const exchangeCode = this.#dependencies.oauthStateRepository.generateExchangeCode();
      await this.#dependencies.oauthStateRepository.saveLinkingData(authorization.id, {
        exchangeCode,
        provider: authorization.provider,
        providerAccountId: profile.id,
      });
      this.#dependencies.logger.debug({
        event: IdentityLogEvent.OAUTH_EXCHANGE_CREATED,
        oauthStateId: authorization.id,
        mode: "link",
        provider: authorization.provider,
      });
      return { exchangeCode, redirectUri, userId: profile.id };
    }
    const loginResult = await this.#dependencies.loginWithOAuthToken.execute({
      provider,
      token: exchanged.token,
      metadata,
    });
    const exchangeCode = this.#dependencies.oauthStateRepository.generateExchangeCode();
    await this.#dependencies.oauthStateRepository.saveExchangeData(authorization.id, {
      exchangeCode,
      accessToken: loginResult.tokens.accessToken,
      refreshToken: loginResult.tokens.refreshToken,
      userId: loginResult.userId,
      userName: loginResult.name ?? undefined,
      profileImage: loginResult.profileImage ?? undefined,
      accountRestored: loginResult.accountRestored,
    });
    this.#dependencies.logger.debug({
      event: IdentityLogEvent.OAUTH_EXCHANGE_CREATED,
      oauthStateId: authorization.id,
      mode: "login",
      userId: loginResult.userId,
    });
    return {
      exchangeCode,
      redirectUri,
      userId: loginResult.userId,
      name: loginResult.name ?? undefined,
      profileImage: loginResult.profileImage ?? undefined,
    };
  }
}
