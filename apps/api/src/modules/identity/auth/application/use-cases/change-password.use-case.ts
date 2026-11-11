import { ErrorCode } from "@aido/api/errors";
import { SECURITY_EVENT, REVOKE_REASON } from "@aido/api/vocabulary";

import { accountDeleted } from "#api/modules/identity/auth/application/auth.errors";
import type { RequestMetadata } from "#api/modules/identity/auth/application/read-models/auth-result.read-model";
import { AUTH_DEFAULTS } from "#api/modules/identity/auth/domain/auth.constants";
import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { SessionId } from "../../domain/session-id.vo.js";
import { AuthLogEvent } from "../auth.log-events.js";
import type { AuthAccountRepositoryPort } from "../ports/auth-account.repository.port.js";
import type { AuthCachePort } from "../ports/auth-collaboration.port.js";
import type { AuthPasswordHasherPort } from "../ports/auth-crypto.port.js";
import type { AuthSecurityLogRepositoryPort } from "../ports/auth-security-log.repository.port.js";
import type { AuthSessionRepositoryPort } from "../ports/auth-session.repository.port.js";
import type { AuthUserRepositoryPort } from "../ports/auth-user.repository.port.js";
import type { SessionPushDeviceReleaserPort } from "../ports/session-push-device-releaser.port.js";

export interface ChangePasswordCommand {
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
    const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
    const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

    const user = await this.#dependencies.userRepository.findById(userId);
    if (user == null) {
      throw new ApplicationException(ErrorCode.USER_0601, { userId: input.userId });
    }
    if (user.isDeleted) {
      throw accountDeleted(user.id.value);
    }

    const account = await this.#dependencies.accountRepository.findByUserIdAndProvider(
      userId,
      "CREDENTIAL",
    );
    if (account == null || account.password == null || account.password === "") {
      throw new ApplicationException(ErrorCode.USER_0613, { userId: input.userId });
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
    this.#dependencies.logger.log({ event: AuthLogEvent.PASSWORD_CHANGED, userId: input.userId });

    return { message: "비밀번호가 변경되었습니다." };
  }
}
