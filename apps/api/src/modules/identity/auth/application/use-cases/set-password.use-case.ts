import { ErrorCode } from "@aido/api/errors";
import { SECURITY_EVENT } from "@aido/api/vocabulary";

import { accountDeleted } from "#api/modules/identity/auth/application/auth.errors";
import type { RequestMetadata } from "#api/modules/identity/auth/application/read-models/auth-result.read-model";
import { AUTH_DEFAULTS } from "#api/modules/identity/auth/domain/auth.constants";
import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";

import { AuthLogEvent } from "../auth.log-events.js";
import type { AuthCachePort } from "../ports/auth-collaboration.port.js";
import type { AuthPasswordHasherPort } from "../ports/auth-crypto.port.js";
import type {
  AuthUserRepositoryPort,
  AuthAccountRepositoryPort,
  AuthSecurityLogRepositoryPort,
} from "../ports/auth-persistence.port.js";
import type { VerificationService } from "./issue-verification-code.use-case.js";

export interface SetPasswordCommand {
  readonly userId: string;
  readonly code: string;
  readonly newPassword: string;
  readonly metadata?: RequestMetadata;
}

interface SetPasswordDependencies {
  readonly userRepository: Pick<AuthUserRepositoryPort, "findById"> &
    Pick<AuthUserRepositoryPort, "findByIdForUpdate">;
  readonly accountRepository: Pick<
    AuthAccountRepositoryPort,
    "findByUserIdAndProvider" | "createCredentialAccount"
  >;
  readonly passwordService: Pick<AuthPasswordHasherPort, "hash">;
  readonly verificationService: Pick<VerificationService, "verifyCode">;
  readonly securityLogRepository: Pick<AuthSecurityLogRepositoryPort, "create">;
  readonly cacheService: Pick<AuthCachePort, "invalidateUserProfile">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLoggerPort;
}

export class SetPasswordUseCase {
  readonly #dependencies: SetPasswordDependencies;

  constructor(dependencies: SetPasswordDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SetPasswordCommand): Promise<{ message: string }> {
    const { userId, code, newPassword, metadata } = input;
    const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
    const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

    const user = await this.#dependencies.userRepository.findById(userId);
    if (user == null) {
      throw new ApplicationException(ErrorCode.USER_0601, { userId });
    }
    if (user.isDeleted) {
      throw accountDeleted(user.id.value);
    }

    const existingAccount = await this.#dependencies.accountRepository.findByUserIdAndProvider(
      userId,
      "CREDENTIAL",
    );
    if (existingAccount != null) {
      throw new ApplicationException(ErrorCode.USER_0614, { userId });
    }

    const hashedPassword = await this.#dependencies.passwordService.hash(newPassword);

    await this.#dependencies.unitOfWork.run(async () => {
      const lockedUser = await this.#dependencies.userRepository.findByIdForUpdate(userId);
      if (lockedUser == null) {
        throw new ApplicationException(ErrorCode.USER_0601, { userId });
      }
      if (lockedUser.isDeleted) {
        throw accountDeleted(lockedUser.id.value);
      }
      const currentAccount = await this.#dependencies.accountRepository.findByUserIdAndProvider(
        userId,
        "CREDENTIAL",
      );
      if (currentAccount != null) {
        throw new ApplicationException(ErrorCode.USER_0614, { userId });
      }
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
    this.#dependencies.logger.log({ event: AuthLogEvent.PASSWORD_SET, userId });

    return {
      message: "비밀번호가 설정되었습니다. 이제 이메일로 로그인할 수 있습니다.",
    };
  }
}
