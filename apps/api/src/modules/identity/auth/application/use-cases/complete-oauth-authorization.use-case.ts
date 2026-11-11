import { ErrorCode } from "@aido/api/errors";
import type { OAUTH_PROVIDERS } from "@aido/api/vocabulary";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";

import { AuthLogEvent } from "../auth.log-events.js";
import type { AuthOAuthStateRepositoryPort } from "../ports/auth-oauth-state.repository.port.js";
import type { OAuthIdentityProviderRegistryPort } from "../ports/oauth-identity-provider.port.js";
import type { RequestMetadata } from "../read-models/auth-result.read-model.js";
import type { LoginWithOAuthTokenUseCase } from "./login-with-oauth-token.use-case.js";

export interface CompleteOAuthAuthorizationCommand {
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
  readonly registry: Pick<OAuthIdentityProviderRegistryPort, "get">;
  readonly oauthStateRepository: Pick<
    AuthOAuthStateRepositoryPort,
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
  ): Promise<CompleteOAuthAuthorizationResult> {
    const { provider, code, state, metadata } = input;
    const strategy = this.#dependencies.registry.get(provider);
    if (strategy == null) {
      throw new ApplicationException(ErrorCode.SOCIAL_0204, {
        provider,
        reason: `Unsupported provider: ${provider}`,
      });
    }
    const authorization = await this.#dependencies.oauthStateRepository.findByState(
      state,
      this.#dependencies.clock.now(),
    );
    if (authorization == null) {
      this.#dependencies.logger.warn({ event: AuthLogEvent.OAUTH_STATE_REJECTED });
      throw new ApplicationException(ErrorCode.USER_0602);
    }
    const redirectUri =
      authorization.redirectUri === "" ? "aido://auth/callback" : authorization.redirectUri;
    const exchanged = await strategy.exchangeCode(code, state);
    if (exchanged == null) {
      throw new ApplicationException(ErrorCode.USER_0602);
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
        event: AuthLogEvent.OAUTH_EXCHANGE_CREATED,
        oauthStateId: authorization.id.value,
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
      isNewUser: loginResult.isNewUser,
    });
    this.#dependencies.logger.debug({
      event: AuthLogEvent.OAUTH_EXCHANGE_CREATED,
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
