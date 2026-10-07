import { ErrorCode } from "@aido/api/errors";

import { AuthOAuthState } from "#api/modules/identity/domain/aggregates/auth/auth-oauth-state.aggregate";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { IdentityLogEvent } from "../../observability/auth/identity-log.events.js";
import type { AuthCachePort } from "../../ports/auth/auth-collaboration.port.js";
import type {
  AuthOAuthStateRepositoryPort,
  AuthUserLockRepositoryPort,
} from "../../ports/auth/auth-persistence.port.js";
import type { LinkOAuthIdentity } from "../../services/auth/link-oauth-identity.service.js";
import type { RequestMetadata } from "../../types/auth/index.js";

export interface LinkOAuthAccountWithCodeInput {
  readonly userId: string;
  readonly code: string;
  readonly metadata?: RequestMetadata;
}

interface LinkOAuthAccountWithCodeDependencies {
  readonly userRepository: AuthUserLockRepositoryPort;
  readonly oauthStateRepository: Pick<
    AuthOAuthStateRepositoryPort,
    "findByExchangeCode" | "consumeExchangeCode"
  >;
  readonly linkOAuthIdentity: Pick<LinkOAuthIdentity, "execute">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly cacheService: Pick<AuthCachePort, "invalidateUserProfile">;
  readonly logger: ApplicationLogger;
}

export class LinkOAuthAccountWithCode {
  readonly #dependencies: LinkOAuthAccountWithCodeDependencies;

  constructor(dependencies: LinkOAuthAccountWithCodeDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: LinkOAuthAccountWithCodeInput): Promise<{ message: string }> {
    const result = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.userRepository.findByIdForUpdate(input.userId);
      const at = now();
      const state = await this.#dependencies.oauthStateRepository.findByExchangeCode(
        input.code,
        at,
      );
      if (state === null) throw this.#invalidCode();
      const authorization = AuthOAuthState.reconstitute(state);
      if (authorization.validityAt(at) !== "valid" || !authorization.canLinkFor(input.userId))
        throw this.#invalidCode();
      const providerAccountId = state.userId;
      if (providerAccountId === null || providerAccountId === "") throw this.#invalidCode();
      const consumed = await this.#dependencies.oauthStateRepository.consumeExchangeCode({
        id: state.id,
        exchangeCode: input.code,
        at,
        purpose: "link",
        actorUserId: input.userId,
      });
      if (!consumed) throw this.#invalidCode();
      authorization.consume(at);
      return this.#dependencies.linkOAuthIdentity.execute({
        userId: input.userId,
        provider: state.provider,
        providerAccountId,
        metadata: input.metadata,
      });
    });
    if (result.linked) {
      await this.#dependencies.cacheService.invalidateUserProfile(input.userId);
      this.#dependencies.logger.log({
        event: IdentityLogEvent.OAUTH_ACCOUNT_LINKED,
        userId: input.userId,
      });
    }
    return { message: result.message };
  }

  #invalidCode(): ApplicationException {
    this.#dependencies.logger.warn({
      event: IdentityLogEvent.OAUTH_EXCHANGE_REJECTED,
      mode: "link",
    });
    return new ApplicationException(ErrorCode.USER_0602);
  }
}
