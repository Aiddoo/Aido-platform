import { ACCOUNT_DELETION, REVOKE_REASON, SECURITY_EVENT } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { toIsoString } from "#api/shared/domain/time/instant";

import type { LinkedAccountsRepositoryPort } from "../../../linked-accounts/application/ports/linked-accounts.repository.port.js";
import type { PasswordHasherPort } from "../../../linked-accounts/application/ports/password-hasher.port.js";
import type { SessionCachePort } from "../../../sessions/application/ports/session-cache.port.js";
import type { SessionPushDeviceReleaserPort } from "../../../sessions/application/ports/session-push-device-releaser.port.js";
import type { SessionRepositoryPort } from "../../../sessions/application/ports/session.repository.port.js";
import type { RequestMetadata } from "../../../shared/domain/request-metadata.constants.js";
import { REQUEST_ORIGIN_DEFAULTS } from "../../../shared/domain/request-metadata.constants.js";
import type { SecurityLogRepositoryPort } from "../ports/security-log.repository.port.js";
import type { UserProfileInvalidatorPort } from "../ports/user-profile-invalidator.port.js";
import type { UserRepositoryPort } from "../ports/user.repository.port.js";
import type { AccountDeletionReadModel } from "../read-models/user-account.read-model.js";
import { accountDeleted } from "../users.errors.js";
import { deletionPasswordRequired, invalidCredentials, userNotFound } from "../users.errors.js";
import { UserLogEvent } from "../users.log-events.js";

export interface DeleteAccountCommand {
  readonly userId: string;
  readonly password?: string;
  readonly reason?: string;
  readonly metadata?: RequestMetadata;
}

interface DeleteAccountDependencies {
  readonly userRepository: Pick<UserRepositoryPort, "findById" | "save">;
  readonly accountRepository: Pick<LinkedAccountsRepositoryPort, "findAllByUserId">;
  readonly sessionRepository: Pick<SessionRepositoryPort, "revokeAllByUserId">;
  readonly passwordService: Pick<PasswordHasherPort, "verify">;
  readonly securityLogRepository: Pick<SecurityLogRepositoryPort, "create">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly cacheService: Pick<SessionCachePort, "invalidateSession">;
  readonly userProfileCache: Pick<UserProfileInvalidatorPort, "invalidateUserProfile">;
  readonly pushDevices: Pick<SessionPushDeviceReleaserPort, "releaseSessions">;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

export class DeleteAccountUseCase {
  readonly #dependencies: DeleteAccountDependencies;

  constructor(dependencies: DeleteAccountDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: DeleteAccountCommand): Promise<AccountDeletionReadModel> {
    const userId = UserId.reconstitute(input.userId);
    const user = await this.#dependencies.userRepository.findById(userId);
    if (user == null) {
      throw userNotFound(input.userId);
    }
    if (user.isDeleted) {
      throw accountDeleted(user.id.value);
    }

    const accounts = await this.#dependencies.accountRepository.findAllByUserId(userId);
    const credentialAccount = accounts.find((account) => account.provider === "CREDENTIAL");
    if (credentialAccount != null) {
      if (!input.password) {
        throw deletionPasswordRequired();
      }
      if (!credentialAccount.password) {
        throw invalidCredentials();
      }
      const isValid = await this.#dependencies.passwordService.verify(
        credentialAccount.password,
        input.password,
      );
      if (!isValid) {
        throw invalidCredentials();
      }
    }

    const deletedAt = this.#dependencies.clock.now();
    const identityUser = user;
    identityUser.requestDeletion(deletedAt);
    const revokedSessionIds = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.userRepository.save(identityUser);
      const revokedSessionIds = await this.#dependencies.sessionRepository.revokeAllByUserId({
        userId: identityUser.id,
        reason: REVOKE_REASON.ACCOUNT_DELETION,
        now: deletedAt,
      });
      await this.#dependencies.securityLogRepository.create({
        userId: identityUser.id,
        event: SECURITY_EVENT.ACCOUNT_DELETION_REQUESTED,
        ipAddress: input.metadata?.ip ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_IP,
        userAgent: input.metadata?.userAgent ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_USER_AGENT,
        metadata: {
          reason: input.reason ?? null,
          gracePeriodDays: ACCOUNT_DELETION.GRACE_PERIOD_DAYS,
          providers: accounts.map((account) => account.provider),
        },
      });
      return revokedSessionIds;
    });

    await Promise.all(
      revokedSessionIds.map((sessionId) =>
        this.#dependencies.cacheService.invalidateSession(sessionId),
      ),
    );
    await this.#dependencies.pushDevices.releaseSessions(revokedSessionIds);
    await this.#dependencies.userProfileCache.invalidateUserProfile(identityUser.id);
    this.#dependencies.logger.log({
      event: UserLogEvent.ACCOUNT_DELETION_REQUESTED,
      userId: identityUser.id.value,
    });
    return {
      message: `계정이 탈퇴 처리되었습니다. ${ACCOUNT_DELETION.GRACE_PERIOD_DAYS}일 이내에 복구할 수 있습니다.`,
      deletedAt: toIsoString(deletedAt),
      gracePeriodDays: ACCOUNT_DELETION.GRACE_PERIOD_DAYS,
    };
  }
}
