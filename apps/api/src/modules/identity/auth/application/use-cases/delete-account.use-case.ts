import { ErrorCode } from "@aido/api/errors";
import { ACCOUNT_DELETION, REVOKE_REASON, SECURITY_EVENT } from "@aido/api/vocabulary";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { toIsoString } from "#api/shared/domain/time/instant";

import { AUTH_DEFAULTS } from "../../domain/auth.constants.js";
import { accountDeleted } from "../auth.errors.js";
import { AuthLogEvent } from "../auth.log-events.js";
import type { AuthAccountRepositoryPort } from "../ports/auth-account.repository.port.js";
import type { AuthCachePort } from "../ports/auth-collaboration.port.js";
import type { AuthPasswordHasherPort } from "../ports/auth-crypto.port.js";
import type { AuthSecurityLogRepositoryPort } from "../ports/auth-security-log.repository.port.js";
import type { AuthSessionRepositoryPort } from "../ports/auth-session.repository.port.js";
import type { AuthUserRepositoryPort } from "../ports/auth-user.repository.port.js";
import type { SessionPushDeviceReleaserPort } from "../ports/session-push-device-releaser.port.js";
import type {
  DeleteAccountResult,
  RequestMetadata,
} from "../read-models/auth-result.read-model.js";

export interface DeleteAccountCommand {
  readonly userId: string;
  readonly password?: string;
  readonly reason?: string;
  readonly metadata?: RequestMetadata;
}

interface DeleteAccountDependencies {
  readonly userRepository: Pick<AuthUserRepositoryPort, "findById" | "saveAccountStatus">;
  readonly accountRepository: Pick<AuthAccountRepositoryPort, "findAllByUserId">;
  readonly sessionRepository: Pick<AuthSessionRepositoryPort, "revokeAllByUserId">;
  readonly passwordService: Pick<AuthPasswordHasherPort, "verify">;
  readonly securityLogRepository: Pick<AuthSecurityLogRepositoryPort, "create">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly cacheService: Pick<AuthCachePort, "invalidateSession" | "invalidateUserProfile">;
  readonly pushDevices: Pick<SessionPushDeviceReleaserPort, "releaseSessions">;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

export class DeleteAccountUseCase {
  readonly #dependencies: DeleteAccountDependencies;

  constructor(dependencies: DeleteAccountDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: DeleteAccountCommand): Promise<DeleteAccountResult> {
    const user = await this.#dependencies.userRepository.findById(input.userId);
    if (user == null) {
      throw new ApplicationException(ErrorCode.USER_0601, { userId: input.userId });
    }
    if (user.isDeleted) {
      throw accountDeleted(user.id.value);
    }

    const accounts = await this.#dependencies.accountRepository.findAllByUserId(input.userId);
    const credentialAccount = accounts.find((account) => account.provider === "CREDENTIAL");
    if (credentialAccount != null) {
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

    const deletedAt = this.#dependencies.clock.now();
    const identityUser = user;
    identityUser.requestDeletion(deletedAt);
    const revokedSessionIds = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.userRepository.saveAccountStatus(identityUser);
      const revokedSessionIds = await this.#dependencies.sessionRepository.revokeAllByUserId(
        identityUser.id.value,
        REVOKE_REASON.ACCOUNT_DELETION,
        undefined,
      );
      await this.#dependencies.securityLogRepository.create({
        userId: identityUser.id.value,
        event: SECURITY_EVENT.ACCOUNT_DELETION_REQUESTED,
        ipAddress: input.metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP,
        userAgent: input.metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
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
    await this.#dependencies.cacheService.invalidateUserProfile(identityUser.id.value);
    this.#dependencies.logger.log({
      event: AuthLogEvent.ACCOUNT_DELETION_REQUESTED,
      userId: identityUser.id.value,
    });
    return {
      message: `계정이 탈퇴 처리되었습니다. ${ACCOUNT_DELETION.GRACE_PERIOD_DAYS}일 이내에 복구할 수 있습니다.`,
      deletedAt: toIsoString(deletedAt),
      gracePeriodDays: ACCOUNT_DELETION.GRACE_PERIOD_DAYS,
    };
  }
}
