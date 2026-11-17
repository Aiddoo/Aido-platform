import { SECURITY_EVENT, REVOKE_REASON } from "@aido/api/vocabulary";

import type { RequestMetadata } from "#api/modules/identity/shared/domain/request-metadata.constants";
import { REQUEST_ORIGIN_DEFAULTS } from "#api/modules/identity/shared/domain/request-metadata.constants";
import { accountDeleted } from "#api/modules/identity/users/application/users.errors";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { SessionCachePort } from "../../../sessions/application/ports/session-cache.port.js";
import type { SessionPushDeviceReleaserPort } from "../../../sessions/application/ports/session-push-device-releaser.port.js";
import type { SessionRepositoryPort } from "../../../sessions/application/ports/session.repository.port.js";
import { SessionId } from "../../../sessions/domain/session-id.vo.js";
import type { SecurityLogRepositoryPort } from "../../../users/application/ports/security-log.repository.port.js";
import type { UserRepositoryPort } from "../../../users/application/ports/user.repository.port.js";
import { invalidCredentials, userNotFound } from "../../../users/application/users.errors.js";
import { socialAccountPasswordUnchangeable } from "../linked-accounts.errors.js";
import { LinkedAccountsLogEvent } from "../linked-accounts.log-events.js";
import type { LinkedAccountsRepositoryPort } from "../ports/linked-accounts.repository.port.js";
import type { PasswordHasherPort } from "../ports/password-hasher.port.js";

export interface ChangePasswordCommand {
  readonly userId: string;
  readonly currentPassword: string;
  readonly newPassword: string;
  readonly metadata?: RequestMetadata;
  readonly currentSessionId?: string;
}

interface ChangePasswordDependencies {
  readonly userRepository: Pick<UserRepositoryPort, "findById">;
  readonly accountRepository: Pick<
    LinkedAccountsRepositoryPort,
    "findByUserIdAndProvider" | "updatePassword"
  >;
  readonly passwordService: Pick<PasswordHasherPort, "verify" | "hash">;
  readonly sessionRepository: Pick<SessionRepositoryPort, "revokeAllByUserId">;
  readonly cacheService: Pick<SessionCachePort, "invalidateSession">;
  readonly securityLogRepository: Pick<SecurityLogRepositoryPort, "create">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly pushDevices: Pick<SessionPushDeviceReleaserPort, "releaseSessions">;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

export class ChangePasswordUseCase {
  readonly #dependencies: ChangePasswordDependencies;

  constructor(dependencies: ChangePasswordDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ChangePasswordCommand): Promise<{ message: string }> {
    const { currentPassword, newPassword, metadata, currentSessionId } = input;
    const userId = UserId.reconstitute(input.userId);
    const ip = metadata?.ip ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_IP;
    const userAgent = metadata?.userAgent ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_USER_AGENT;

    const user = await this.#dependencies.userRepository.findById(userId);
    if (user == null) {
      throw userNotFound(input.userId);
    }
    if (user.isDeleted) {
      throw accountDeleted(user.id.value);
    }

    const account = await this.#dependencies.accountRepository.findByUserIdAndProvider(
      userId,
      "CREDENTIAL",
    );
    if (account == null || account.password == null || account.password === "") {
      throw socialAccountPasswordUnchangeable(input.userId);
    }

    const isValid = await this.#dependencies.passwordService.verify(
      account.password,
      currentPassword,
    );
    if (!isValid) {
      throw invalidCredentials();
    }

    const hashedPassword = await this.#dependencies.passwordService.hash(newPassword);

    const revokedSessionIds = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.accountRepository.updatePassword(userId, hashedPassword);

      const revokedSessionIds = await this.#dependencies.sessionRepository.revokeAllByUserId({
        userId,
        reason: REVOKE_REASON.PASSWORD_CHANGED,
        now: this.#dependencies.clock.now(),
        exceptSessionId:
          currentSessionId == null ? undefined : SessionId.reconstitute(currentSessionId),
      });

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
    await this.#dependencies.pushDevices.releaseSessions(revokedSessionIds);
    this.#dependencies.logger.log({
      event: LinkedAccountsLogEvent.PASSWORD_CHANGED,
      userId: input.userId,
    });

    return { message: "비밀번호가 변경되었습니다." };
  }
}
