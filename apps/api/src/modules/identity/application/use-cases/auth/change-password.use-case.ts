import { ErrorCode } from "@aido/api/errors";

import type { RequestMetadata } from "#api/modules/identity/application/types/auth/index";
import { assertNotDeleted } from "#api/modules/identity/application/utils/auth/auth-validation.utils";
import {
  AUTH_DEFAULTS,
  SECURITY_EVENT,
  REVOKE_REASON,
} from "#api/modules/identity/domain/constants/auth/auth.constants";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { IdentityLogEvent } from "../../observability/auth/identity-log.events.js";
import type { AuthCachePort } from "../../ports/auth/auth-collaboration.port.js";
import type { AuthPasswordHasherPort } from "../../ports/auth/auth-crypto.port.js";
import type {
  AuthUserRepositoryPort,
  AuthAccountRepositoryPort,
  AuthSessionRepositoryPort,
  AuthSecurityLogRepositoryPort,
} from "../../ports/auth/auth-persistence.port.js";

export interface ChangePasswordInput {
  readonly userId: string;
  readonly currentPassword: string;
  readonly newPassword: string;
  readonly metadata?: RequestMetadata;
  readonly currentSessionId?: string;
}

interface ChangePasswordDependencies {
  readonly userRepository: Pick<AuthUserRepositoryPort, "findById">;
  readonly accountRepository: Pick<
    AuthAccountRepositoryPort,
    "findByUserIdAndProvider" | "updatePassword"
  >;
  readonly passwordService: Pick<AuthPasswordHasherPort, "verify" | "hash">;
  readonly sessionRepository: Pick<AuthSessionRepositoryPort, "revokeAllByUserId">;
  readonly cacheService: Pick<AuthCachePort, "invalidateSession">;
  readonly securityLogRepository: Pick<AuthSecurityLogRepositoryPort, "create">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLogger;
}

export class ChangePassword {
  readonly #dependencies: ChangePasswordDependencies;

  constructor(dependencies: ChangePasswordDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ChangePasswordInput): Promise<{ message: string }> {
    const { userId, currentPassword, newPassword, metadata, currentSessionId } = input;
    const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
    const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

    const user = await this.#dependencies.userRepository.findById(userId);
    if (user === null) {
      throw new ApplicationException(ErrorCode.USER_0601, { userId });
    }
    assertNotDeleted(user);

    const account = await this.#dependencies.accountRepository.findByUserIdAndProvider(
      userId,
      "CREDENTIAL",
    );
    if (account === null || account.password === null || account.password === "") {
      throw new ApplicationException(ErrorCode.USER_0613, { userId });
    }

    const isValid = await this.#dependencies.passwordService.verify(
      account.password,
      currentPassword,
    );
    if (!isValid) {
      throw new ApplicationException(ErrorCode.USER_0602);
    }

    const hashedPassword = await this.#dependencies.passwordService.hash(newPassword);

    const revokedSessionIds = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.accountRepository.updatePassword(userId, hashedPassword);

      const revokedSessionIds = await this.#dependencies.sessionRepository.revokeAllByUserId(
        userId,
        REVOKE_REASON.PASSWORD_CHANGED,
        currentSessionId,
      );

      await this.#dependencies.securityLogRepository.create({
        userId,
        event: SECURITY_EVENT.PASSWORD_CHANGED,
        ipAddress: ip,
        userAgent,
      });
      return revokedSessionIds;
    });

    await Promise.all(
      revokedSessionIds.map((sessionId) =>
        this.#dependencies.cacheService.invalidateSession(sessionId),
      ),
    );
    this.#dependencies.logger.log({ event: IdentityLogEvent.PASSWORD_CHANGED, userId });

    return { message: "비밀번호가 변경되었습니다." };
  }
}
