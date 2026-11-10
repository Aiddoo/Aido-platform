import { ErrorCode } from "@aido/api/errors";

import { AuthOAuthState } from "#api/modules/identity/auth/domain/auth-oauth-state.aggregate";
import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";

import { AuthLogEvent } from "../auth.log-events.js";
import type { AuthCachePort } from "../ports/auth-collaboration.port.js";
import type {
  AuthOAuthStateRepositoryPort,
  AuthUserLockRepositoryPort,
} from "../ports/auth-persistence.port.js";
import type { RequestMetadata } from "../read-models/auth-result.read-model.js";
import type { LinkOAuthIdentityUseCase } from "./link-oauth-identity.use-case.js";

export interface LinkOAuthAccountWithCodeCommand {
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
  readonly linkOAuthIdentity: Pick<LinkOAuthIdentityUseCase, "execute">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly cacheService: Pick<AuthCachePort, "invalidateUserProfile">;
  readonly logger: ApplicationLoggerPort;
}

export class LinkOAuthAccountWithCodeUseCase {
  readonly #dependencies: LinkOAuthAccountWithCodeDependencies;

  constructor(dependencies: LinkOAuthAccountWithCodeDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: LinkOAuthAccountWithCodeCommand): Promise<{ message: string }> {
    const result = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.userRepository.findByIdForUpdate(input.userId);
      const at = now();
      const state = await this.#dependencies.oauthStateRepository.findByExchangeCode(
        input.code,
        at,
      );
      if (state == null) {
        throw this.#invalidCode();
      }
      const authorization = AuthOAuthState.reconstitute(state);
      if (authorization.validityAt(at) !== "valid" || !authorization.canLinkFor(input.userId)) {
        throw this.#invalidCode();
      }
      const providerAccountId = state.userId;
      if (providerAccountId == null || providerAccountId === "") {
        throw this.#invalidCode();
      }
      const consumed = await this.#dependencies.oauthStateRepository.consumeExchangeCode({
        id: state.id,
        exchangeCode: input.code,
        at,
        purpose: "link",
        actorUserId: input.userId,
      });
      if (!consumed) {
        throw this.#invalidCode();
      }
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
    return new ApplicationException(ErrorCode.USER_0602);
  }
}
