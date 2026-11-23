import type { OAUTH_PROVIDERS } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { unsupportedOAuthProvider } from "../../../linked-accounts/application/linked-accounts.errors.js";
import type { OAuthIdentityProviderRegistryPort } from "../../../linked-accounts/application/ports/oauth-identity-provider.port.js";
import type { LoginWithOAuthTokenUseCase } from "../../../sessions/application/use-cases/login-with-oauth-token.use-case.js";
import type { RequestMetadata } from "../../../shared/domain/request-metadata.constants.js";
import { invalidCredentials } from "../../../users/application/users.errors.js";
import { DEFAULT_OAUTH_REDIRECT_URI } from "../../domain/oauth-states.constants.js";
import { OAuthStateLogEvent } from "../oauth-states.log-events.js";
import type { OAuthStateRepositoryPort } from "../ports/oauth-state.repository.port.js";

export interface CompleteOAuthAuthorizationCommand {
  readonly provider: Exclude<(typeof OAUTH_PROVIDERS)[number], "APPLE">;
  readonly code: string;
  readonly state: string;
  readonly metadata?: RequestMetadata;
}

export interface CompletedOAuthAuthorizationReadModel {
  exchangeCode: string;
  redirectUri: string;
  userId: string;
  name?: string;
  profileImage?: string;
}

interface CompleteOAuthAuthorizationDependencies {
  readonly registry: Pick<OAuthIdentityProviderRegistryPort, "find">;
  readonly oauthStateRepository: Pick<
    OAuthStateRepositoryPort,
    "findByState" | "generateExchangeCode" | "saveExchangeData" | "saveLinkingData"
  >;
  readonly loginWithOAuthToken: Pick<LoginWithOAuthTokenUseCase, "execute">;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

export class CompleteOAuthAuthorizationUseCase {
  readonly #dependencies: CompleteOAuthAuthorizationDependencies;

  constructor(dependencies: CompleteOAuthAuthorizationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(
    input: CompleteOAuthAuthorizationCommand,
  ): Promise<CompletedOAuthAuthorizationReadModel> {
    const { provider, code, state, metadata } = input;
    const strategy = this.#dependencies.registry.find(provider);
    if (strategy == null) {
      throw unsupportedOAuthProvider(provider);
    }
    const authorization = await this.#dependencies.oauthStateRepository.findByState(
      state,
      this.#dependencies.clock.now(),
    );
    if (authorization == null) {
      this.#dependencies.logger.warn({ event: OAuthStateLogEvent.OAUTH_STATE_REJECTED });
      throw invalidCredentials();
    }
    const redirectUri =
      authorization.redirectUri === "" ? DEFAULT_OAUTH_REDIRECT_URI : authorization.redirectUri;
    const exchanged = await strategy.exchangeCode(code, state);
    if (exchanged == null) {
      throw invalidCredentials();
    }
    if (authorization.mode === "link") {
      const profile = await strategy.verifyToken(exchanged.token);
      const exchangeCode = this.#dependencies.oauthStateRepository.generateExchangeCode();
      await this.#dependencies.oauthStateRepository.saveLinkingData(authorization.id, {
        exchangeCode,
        provider: authorization.provider,
        providerAccountId: profile.id,
      });
      this.#dependencies.logger.debug({
        event: OAuthStateLogEvent.OAUTH_EXCHANGE_CREATED,
        oauthStateId: authorization.id.value,
        mode: "link",
        provider: authorization.provider,
      });
      return { exchangeCode, redirectUri, userId: profile.id.value };
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
      userId: UserId.reconstitute(loginResult.userId),
      userName: loginResult.name ?? undefined,
      profileImage: loginResult.profileImage ?? undefined,
      accountRestored: loginResult.accountRestored,
      isNewUser: loginResult.isNewUser,
    });
    this.#dependencies.logger.debug({
      event: OAuthStateLogEvent.OAUTH_EXCHANGE_CREATED,
      oauthStateId: authorization.id.value,
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
