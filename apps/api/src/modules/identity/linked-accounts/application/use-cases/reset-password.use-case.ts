import { SECURITY_EVENT, REVOKE_REASON } from "@aido/api/vocabulary";

import { REQUEST_ORIGIN_DEFAULTS } from "#api/modules/identity/shared/domain/request-metadata.constants";
import { accountDeleted } from "#api/modules/identity/users/application/users.errors";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import type { SessionCachePort } from "../../../sessions/application/ports/session-cache.port.js";
import type { SessionPushDeviceReleaserPort } from "../../../sessions/application/ports/session-push-device-releaser.port.js";
import type { SessionRepositoryPort } from "../../../sessions/application/ports/session.repository.port.js";
import type { SecurityLogRepositoryPort } from "../../../users/application/ports/security-log.repository.port.js";
import type { UserMutationLockPort } from "../../../users/application/ports/user-mutation-lock.port.js";
import type { UserRepositoryPort } from "../../../users/application/ports/user.repository.port.js";
import type { ConsumeVerificationCodeUseCase } from "../../../verifications/application/use-cases/consume-verification-code.use-case.js";
import { invalidVerificationCode } from "../../../verifications/application/verifications.errors.js";
import { socialAccountPasswordUnchangeable } from "../../domain/linked-accounts.errors.js";
import { LinkedAccountsLogEvent } from "../linked-accounts.log-events.js";
import type { LinkedAccountsRepositoryPort } from "../ports/linked-accounts.repository.port.js";
import type { PasswordHasherPort } from "../ports/password-hasher.port.js";

export interface ResetPasswordCommand {
  readonly email: string;
  readonly code: string;
  readonly newPassword: string;
}

interface ResetPasswordDependencies {
  readonly userRepository: Pick<UserRepositoryPort, "findByEmail">;
  readonly userMutationLock: Pick<UserMutationLockPort, "lockById">;
  readonly accountRepository: Pick<LinkedAccountsRepositoryPort, "findByUserId" | "save">;
  readonly passwordService: Pick<PasswordHasherPort, "hash">;
  readonly consumeVerificationCode: Pick<ConsumeVerificationCodeUseCase, "execute">;
  readonly sessionRepository: Pick<SessionRepositoryPort, "revokeAllByUserId">;
  readonly cacheService: Pick<SessionCachePort, "invalidateSession">;
  readonly securityLogRepository: Pick<SecurityLogRepositoryPort, "create">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly pushDevices: Pick<SessionPushDeviceReleaserPort, "releaseSessions">;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

export class ResetPasswordUseCase {
  readonly #dependencies: ResetPasswordDependencies;

  constructor(dependencies: ResetPasswordDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ResetPasswordCommand): Promise<{ message: string }> {
    const { email, code, newPassword } = input;
    const user = await this.#dependencies.userRepository.findByEmail(email);
    if (user == null) {
      throw invalidVerificationCode();
    }
    if (user.isDeleted) {
      throw accountDeleted(user.id.value);
    }

    const { accountRepository } = this.#dependencies;
    // 코드를 확인하기 전에 거절해 소셜 전용 계정은 코드를 쓰지 않는다
    if (!(await accountRepository.findByUserId(user.id))?.hasCredentialAccount()) {
      throw socialAccountPasswordUnchangeable(user.id.value);
    }

    const hashedPassword = await this.#dependencies.passwordService.hash(newPassword);

    const revokedSessionIds = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.consumeVerificationCode.execute({
        userId: user.id.value,
        code,
        type: "PASSWORD_RESET",
      });

      // 재설정은 지금 비밀번호를 몰라도 되므로 잠근 뒤 다시 읽은 hash 위에 바꾼다
      if (!(await this.#dependencies.userMutationLock.lockById(user.id))) {
        throw invalidVerificationCode();
      }
      const accounts = await accountRepository.findByUserId(user.id);
      const now = this.#dependencies.clock.now();
      if (accounts == null) {
        throw socialAccountPasswordUnchangeable(user.id.value);
      }
      accounts.changePassword(hashedPassword, now);
      if (!(await accountRepository.save(accounts))) {
        throw socialAccountPasswordUnchangeable(user.id.value);
      }

      const revokedSessionIds = await this.#dependencies.sessionRepository.revokeAllByUserId({
        userId: user.id,
        reason: REVOKE_REASON.PASSWORD_RESET,
        now,
      });

      await this.#dependencies.securityLogRepository.create({
        userId: user.id,
        event: SECURITY_EVENT.PASSWORD_CHANGED,
        ipAddress: REQUEST_ORIGIN_DEFAULTS.UNKNOWN_IP,
        userAgent: REQUEST_ORIGIN_DEFAULTS.UNKNOWN_USER_AGENT,
        metadata: { email, reason: REVOKE_REASON.PASSWORD_RESET },
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
      event: LinkedAccountsLogEvent.PASSWORD_RESET_COMPLETED,
      userId: user.id.value,
    });

    return { message: "비밀번호가 재설정되었습니다. 다시 로그인해주세요." };
  }
}
