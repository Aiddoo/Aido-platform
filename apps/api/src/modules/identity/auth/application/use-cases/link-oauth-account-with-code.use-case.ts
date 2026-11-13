import type { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { invalidCredentials } from "../auth.errors.js";
import { AuthLogEvent } from "../auth.log-events.js";
import type { AuthCachePort } from "../ports/auth-collaboration.port.js";
import type { AuthOAuthStateRepositoryPort } from "../ports/auth-oauth-state.repository.port.js";
import type { AuthUserRepositoryPort } from "../ports/auth-user.repository.port.js";
import type { RequestMetadata } from "../read-models/auth-result.read-model.js";
import type { LinkOAuthIdentityUseCase } from "./link-oauth-identity.use-case.js";

export interface LinkOAuthAccountWithCodeCommand {
  readonly userId: string;
  readonly code: string;
  readonly metadata?: RequestMetadata;
}

interface LinkOAuthAccountWithCodeDependencies {
  readonly userRepository: Pick<AuthUserRepositoryPort, "findByIdForUpdate">;
  readonly oauthStateRepository: Pick<
    AuthOAuthStateRepositoryPort,
    "findByExchangeCode" | "consumeExchangeCode"
  >;
  readonly linkOAuthIdentity: Pick<LinkOAuthIdentityUseCase, "execute">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly cacheService: Pick<AuthCachePort, "invalidateUserProfile">;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

export class LinkOAuthAccountWithCodeUseCase {
  readonly #dependencies: LinkOAuthAccountWithCodeDependencies;

  constructor(dependencies: LinkOAuthAccountWithCodeDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: LinkOAuthAccountWithCodeCommand): Promise<{ message: string }> {
    const userId = UserId.reconstitute(input.userId);
    const result = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.userRepository.findByIdForUpdate(userId);
      const at = this.#dependencies.clock.now();
      const state = await this.#dependencies.oauthStateRepository.findByExchangeCode(
        input.code,
        at,
      );
      if (state == null || state.validityAt(at) !== "valid" || !state.canLinkFor(input.userId)) {
        throw this.#invalidCode();
      }
      const providerAccountId = state.linkedProviderAccountId();
      if (providerAccountId == null) {
        throw this.#invalidCode();
      }
      const consumed = await this.#dependencies.oauthStateRepository.consumeExchangeCode({
        id: state.id,
        exchangeCode: input.code,
        at,
        purpose: "link",
        actorUserId: userId,
      });
      if (!consumed) {
        throw this.#invalidCode();
      }
      state.consume(at);
      return this.#dependencies.linkOAuthIdentity.execute({
        userId: input.userId,
        provider: state.provider,
        providerAccountId,
        metadata: input.metadata,
      });
    });
    if (result.linked) {
      await this.#dependencies.cacheService.invalidateUserProfile(userId);
      this.#dependencies.logger.log({
        event: AuthLogEvent.OAUTH_ACCOUNT_LINKED,
        userId: input.userId,
      });
    }
    return { message: result.message };
  }

  #invalidCode(): ApplicationException {
    this.#dependencies.logger.warn({
      event: AuthLogEvent.OAUTH_EXCHANGE_REJECTED,
      mode: "link",
    });
    return invalidCredentials();
  }
}
