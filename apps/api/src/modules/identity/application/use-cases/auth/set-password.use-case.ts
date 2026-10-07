import { ErrorCode } from "@aido/api/errors";

import type { RequestMetadata } from "#api/modules/identity/application/types/auth/index";
import { assertNotDeleted } from "#api/modules/identity/application/utils/auth/auth-validation.utils";
import {
  AUTH_DEFAULTS,
  SECURITY_EVENT,
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
  AuthSecurityLogRepositoryPort,
} from "../../ports/auth/auth-persistence.port.js";
import type { VerificationService } from "../../services/auth/verification.service.js";

export interface SetPasswordInput {
  readonly userId: string;
  readonly code: string;
  readonly newPassword: string;
  readonly metadata?: RequestMetadata;
}

interface SetPasswordDependencies {
  readonly userRepository: Pick<AuthUserRepositoryPort, "findById">;
  readonly accountRepository: Pick<
    AuthAccountRepositoryPort,
    "findByUserIdAndProvider" | "createCredentialAccount"
  >;
  readonly passwordService: Pick<AuthPasswordHasherPort, "hash">;
  readonly verificationService: Pick<VerificationService, "verifyCode">;
  readonly securityLogRepository: Pick<AuthSecurityLogRepositoryPort, "create">;
  readonly cacheService: Pick<AuthCachePort, "invalidateUserProfile">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLogger;
}

export class SetPassword {
  readonly #dependencies: SetPasswordDependencies;

  constructor(dependencies: SetPasswordDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SetPasswordInput): Promise<{ message: string }> {
    const { userId, code, newPassword, metadata } = input;
    const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
    const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

    const user = await this.#dependencies.userRepository.findById(userId);
    if (user === null) {
      throw new ApplicationException(ErrorCode.USER_0601, { userId });
    }
    assertNotDeleted(user);

    const existingAccount = await this.#dependencies.accountRepository.findByUserIdAndProvider(
      userId,
      "CREDENTIAL",
    );
    if (existingAccount !== null) {
      throw new ApplicationException(ErrorCode.USER_0614, { userId });
    }

    const hashedPassword = await this.#dependencies.passwordService.hash(newPassword);

    await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.verificationService.verifyCode(userId, code, "PASSWORD_SETUP");

      await this.#dependencies.accountRepository.createCredentialAccount(userId, hashedPassword);

      await this.#dependencies.securityLogRepository.create({
        userId,
        event: SECURITY_EVENT.PASSWORD_SETUP,
        ipAddress: ip,
        userAgent,
      });
    });

    await this.#dependencies.cacheService.invalidateUserProfile(userId);
    this.#dependencies.logger.log({ event: IdentityLogEvent.PASSWORD_SET, userId });

    return {
      message: "비밀번호가 설정되었습니다. 이제 이메일로 로그인할 수 있습니다.",
    };
  }
}
