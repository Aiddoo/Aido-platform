import { ErrorCode } from "@aido/api/errors";

import { AuthOAuthState } from "#api/modules/identity/domain/aggregates/auth/auth-oauth-state.aggregate";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { IdentityLogEvent } from "../../observability/auth/identity-log.events.js";
import type { AuthOAuthStateRepositoryPort } from "../../ports/auth/auth-persistence.port.js";
import type { ExchangeCodeResult } from "../../types/auth/index.js";

export interface ExchangeOAuthCodeInput {
  readonly code: string;
}

interface ExchangeOAuthCodeDependencies {
  readonly oauthStateRepository: Pick<
    AuthOAuthStateRepositoryPort,
    "findByExchangeCode" | "consumeExchangeCode"
  >;
  readonly logger: ApplicationLogger;
}

export class ExchangeOAuthCode {
  readonly #dependencies: ExchangeOAuthCodeDependencies;

  constructor(dependencies: ExchangeOAuthCodeDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ExchangeOAuthCodeInput): Promise<ExchangeCodeResult> {
    const at = now();
    const state = await this.#dependencies.oauthStateRepository.findByExchangeCode(input.code, at);
    if (state === null) throw this.#invalidCode();
    const authorization = AuthOAuthState.reconstitute(state);
    if (authorization.validityAt(at) !== "valid") throw this.#invalidCode();
    const { accessToken, refreshToken, userId } = state;
    if (
      accessToken === null ||
      accessToken === "" ||
      refreshToken === null ||
      refreshToken === "" ||
      userId === null ||
      userId === ""
    )
      throw this.#invalidCode();
    const consumed = await this.#dependencies.oauthStateRepository.consumeExchangeCode({
      id: state.id,
      exchangeCode: input.code,
      at,
      purpose: "login",
    });
    if (!consumed) throw this.#invalidCode();
    authorization.consume(at);
    this.#dependencies.logger.debug({ event: IdentityLogEvent.OAUTH_EXCHANGE_CONSUMED, userId });
    return {
      accessToken,
      refreshToken,
      userId,
      userName: state.userName ?? undefined,
      profileImage: state.profileImage ?? undefined,
      accountRestored: state.accountRestored ?? undefined,
    };
  }

  #invalidCode(): ApplicationException {
    this.#dependencies.logger.warn({
      event: IdentityLogEvent.OAUTH_EXCHANGE_REJECTED,
      mode: "login",
    });
    return new ApplicationException(ErrorCode.USER_0602);
  }
}
