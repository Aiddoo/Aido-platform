import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import { toISOString } from "#api/shared/domain/date/utils/format";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { IdentityUser } from "../../../domain/aggregates/auth/identity-user.aggregate.js";
import {
  ACCOUNT_DELETION,
  AUTH_DEFAULTS,
  REVOKE_REASON,
  SECURITY_EVENT,
} from "../../../domain/constants/auth/auth.constants.js";
import { IdentityLogEvent } from "../../observability/auth/identity-log.events.js";
import type { AuthCachePort } from "../../ports/auth/auth-collaboration.port.js";
import type { AuthPasswordHasherPort } from "../../ports/auth/auth-crypto.port.js";
import type {
  AuthAccountRepositoryPort,
  AuthSecurityLogRepositoryPort,
  AuthSessionRepositoryPort,
  AuthUserRepositoryPort,
} from "../../ports/auth/auth-persistence.port.js";
import type { DeleteAccountResult, RequestMetadata } from "../../types/auth/index.js";
import { assertNotDeleted } from "../../utils/auth/auth-validation.utils.js";

export interface DeleteAccountInput {
  readonly userId: string;
  readonly password?: string;
  readonly reason?: string;
  readonly metadata?: RequestMetadata;
}

interface DeleteAccountDependencies {
  readonly userRepository: Pick<AuthUserRepositoryPort, "findById" | "softDelete">;
  readonly accountRepository: Pick<AuthAccountRepositoryPort, "findAllByUserId">;
  readonly sessionRepository: Pick<
    AuthSessionRepositoryPort,
    "findActiveByUserId" | "revokeAllByUserId"
  >;
  readonly passwordService: Pick<AuthPasswordHasherPort, "verify">;
  readonly securityLogRepository: Pick<AuthSecurityLogRepositoryPort, "create">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly cacheService: Pick<AuthCachePort, "invalidateSession" | "invalidateUserProfile">;
  readonly logger: ApplicationLogger;
}

export class DeleteAccount {
  readonly #dependencies: DeleteAccountDependencies;

  constructor(dependencies: DeleteAccountDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: DeleteAccountInput): Promise<DeleteAccountResult> {
    const user = await this.#dependencies.userRepository.findById(input.userId);
    if (user === null) {
      throw new ApplicationException(ErrorCode.USER_0601, { userId: input.userId });
    }
    assertNotDeleted(user);

    const accounts = await this.#dependencies.accountRepository.findAllByUserId(input.userId);
    const credentialAccount = accounts.find((account) => account.provider === "CREDENTIAL");
    if (credentialAccount !== undefined) {
      if (!input.password) {
        throw new ApplicationException(ErrorCode.USER_0612);
      }
      if (!credentialAccount.password) {
        throw new ApplicationException(ErrorCode.USER_0602);
      }
      const isValid = await this.#dependencies.passwordService.verify(
        credentialAccount.password,
        input.password,
      );
      if (!isValid) {
        throw new ApplicationException(ErrorCode.USER_0602);
      }
    }

    const activeSessions = await this.#dependencies.sessionRepository.findActiveByUserId(
      input.userId,
    );
    const deletedAt = now();
    const identityUser = IdentityUser.reconstitute(user);
    identityUser.requestDeletion(deletedAt);
    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.userRepository.softDelete(identityUser.id, deletedAt);
      await this.#dependencies.sessionRepository.revokeAllByUserId(
        identityUser.id,
        REVOKE_REASON.ACCOUNT_DELETION,
        undefined,
      );
      await this.#dependencies.securityLogRepository.create({
        userId: identityUser.id,
        event: SECURITY_EVENT.ACCOUNT_DELETION_REQUESTED,
        ipAddress: input.metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP,
        userAgent: input.metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
        metadata: {
          reason: input.reason ?? null,
          gracePeriodDays: ACCOUNT_DELETION.GRACE_PERIOD_DAYS,
          providers: accounts.map((account) => account.provider),
        },
      });
    });

    await Promise.all(
      activeSessions.map((session) =>
        this.#dependencies.cacheService.invalidateSession(session.id),
      ),
    );
    await this.#dependencies.cacheService.invalidateUserProfile(identityUser.id);
    this.#dependencies.logger.log({
      event: IdentityLogEvent.ACCOUNT_DELETION_REQUESTED,
      userId: identityUser.id,
    });
    return {
      message: `계정이 탈퇴 처리되었습니다. ${ACCOUNT_DELETION.GRACE_PERIOD_DAYS}일 이내에 복구할 수 있습니다.`,
      deletedAt: toISOString(deletedAt),
      gracePeriodDays: ACCOUNT_DELETION.GRACE_PERIOD_DAYS,
    };
  }
}
