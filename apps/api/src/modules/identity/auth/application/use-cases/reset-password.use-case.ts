import { ErrorCode } from "@aido/api/errors";
import { SECURITY_EVENT, REVOKE_REASON } from "@aido/api/vocabulary";

import { accountDeleted } from "#api/modules/identity/auth/application/auth.errors";
import { AUTH_DEFAULTS } from "#api/modules/identity/auth/domain/auth.constants";
import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { AuthLogEvent } from "../auth.log-events.js";
import type { AuthAccountRepositoryPort } from "../ports/auth-account.repository.port.js";
import type { AuthCachePort } from "../ports/auth-collaboration.port.js";
import type { AuthPasswordHasherPort } from "../ports/auth-crypto.port.js";
import type { AuthSecurityLogRepositoryPort } from "../ports/auth-security-log.repository.port.js";
import type { AuthSessionRepositoryPort } from "../ports/auth-session.repository.port.js";
import type { AuthUserRepositoryPort } from "../ports/auth-user.repository.port.js";
import type { SessionPushDeviceReleaserPort } from "../ports/session-push-device-releaser.port.js";
import type { ConsumeVerificationCodeUseCase } from "./consume-verification-code.use-case.js";

export interface ResetPasswordCommand {
  readonly email: string;
  readonly code: string;
  readonly newPassword: string;
}

interface ResetPasswordDependencies {
  readonly userRepository: Pick<AuthUserRepositoryPort, "findByEmail">;
  readonly accountRepository: Pick<
    AuthAccountRepositoryPort,
    "findByUserIdAndProvider" | "updatePassword"
  >;
  readonly passwordService: Pick<AuthPasswordHasherPort, "hash">;
  readonly consumeVerificationCode: Pick<ConsumeVerificationCodeUseCase, "execute">;
  readonly sessionRepository: Pick<AuthSessionRepositoryPort, "revokeAllByUserId">;
  readonly cacheService: Pick<AuthCachePort, "invalidateSession">;
  readonly securityLogRepository: Pick<AuthSecurityLogRepositoryPort, "create">;
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
      throw new ApplicationException(ErrorCode.VERIFY_0751);
    }
    if (user.isDeleted) {
      throw accountDeleted(user.id.value);
    }

    const account = await this.#dependencies.accountRepository.findByUserIdAndProvider(
      user.id,
      "CREDENTIAL",
    );
    if (account == null) {
      throw new ApplicationException(ErrorCode.USER_0613, { userId: user.id.value });
    }

    const hashedPassword = await this.#dependencies.passwordService.hash(newPassword);

    const revokedSessionIds = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.consumeVerificationCode.execute({
        userId: user.id.value,
        code,
        type: "PASSWORD_RESET",
      });

      await this.#dependencies.accountRepository.updatePassword(user.id, hashedPassword);

      const revokedSessionIds = await this.#dependencies.sessionRepository.revokeAllByUserId({
        userId: user.id,
        reason: REVOKE_REASON.PASSWORD_RESET,
        now: this.#dependencies.clock.now(),
      });

      await this.#dependencies.securityLogRepository.create({
        userId: user.id,
        event: SECURITY_EVENT.PASSWORD_CHANGED,
        ipAddress: AUTH_DEFAULTS.UNKNOWN_IP,
        userAgent: AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
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
      event: AuthLogEvent.PASSWORD_RESET_COMPLETED,
      userId: user.id.value,
    });

    return { message: "비밀번호가 재설정되었습니다. 다시 로그인해주세요." };
  }
}
