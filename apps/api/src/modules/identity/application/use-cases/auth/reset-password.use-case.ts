import { ErrorCode } from "@aido/api/errors";

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
import type { VerificationService } from "../../services/auth/verification.service.js";

export interface ResetPasswordInput {
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
  readonly verificationService: Pick<VerificationService, "verifyCode">;
  readonly sessionRepository: Pick<AuthSessionRepositoryPort, "revokeAllByUserId">;
  readonly cacheService: Pick<AuthCachePort, "invalidateSession">;
  readonly securityLogRepository: Pick<AuthSecurityLogRepositoryPort, "create">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLogger;
}

export class ResetPassword {
  readonly #dependencies: ResetPasswordDependencies;

  constructor(dependencies: ResetPasswordDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ResetPasswordInput): Promise<{ message: string }> {
    const { email, code, newPassword } = input;
    const user = await this.#dependencies.userRepository.findByEmail(email);
    if (user === null) {
      throw new ApplicationException(ErrorCode.VERIFY_0751);
    }
    assertNotDeleted(user);

    const account = await this.#dependencies.accountRepository.findByUserIdAndProvider(
      user.id,
      "CREDENTIAL",
    );
    if (account === null) {
      throw new ApplicationException(ErrorCode.USER_0613, { userId: user.id });
    }

    const hashedPassword = await this.#dependencies.passwordService.hash(newPassword);

    const revokedSessionIds = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.verificationService.verifyCode(user.id, code, "PASSWORD_RESET");

      await this.#dependencies.accountRepository.updatePassword(user.id, hashedPassword);

      const revokedSessionIds = await this.#dependencies.sessionRepository.revokeAllByUserId(
        user.id,
        REVOKE_REASON.PASSWORD_RESET,
        undefined,
      );

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
    this.#dependencies.logger.log({
      event: IdentityLogEvent.PASSWORD_RESET_COMPLETED,
      userId: user.id,
    });

    return { message: "비밀번호가 재설정되었습니다. 다시 로그인해주세요." };
  }
}
