import { SECURITY_EVENT } from "@aido/api/vocabulary";

import type { RequestMetadata } from "#api/modules/identity/shared/domain/request-metadata.constants";
import { REQUEST_ORIGIN_DEFAULTS } from "#api/modules/identity/shared/domain/request-metadata.constants";
import { accountDeleted } from "#api/modules/identity/users/application/users.errors";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { SecurityLogRepositoryPort } from "../../../users/application/ports/security-log.repository.port.js";
import type { UserProfileInvalidatorPort } from "../../../users/application/ports/user-profile-invalidator.port.js";
import type { UserRepositoryPort } from "../../../users/application/ports/user.repository.port.js";
import { userNotFound } from "../../../users/application/users.errors.js";
import type { ConsumeVerificationCodeUseCase } from "../../../verifications/application/use-cases/consume-verification-code.use-case.js";
import { passwordAlreadySet } from "../linked-accounts.errors.js";
import { LinkedAccountsLogEvent } from "../linked-accounts.log-events.js";
import type { LinkedAccountsRepositoryPort } from "../ports/linked-accounts.repository.port.js";
import type { PasswordHasherPort } from "../ports/password-hasher.port.js";

export interface SetPasswordCommand {
  readonly userId: string;
  readonly code: string;
  readonly newPassword: string;
  readonly metadata?: RequestMetadata;
}

interface SetPasswordDependencies {
  readonly userRepository: Pick<UserRepositoryPort, "findById"> &
    Pick<UserRepositoryPort, "findByIdForUpdate">;
  readonly accountRepository: Pick<
    LinkedAccountsRepositoryPort,
    "findByUserIdAndProvider" | "createCredentialAccount"
  >;
  readonly passwordService: Pick<PasswordHasherPort, "hash">;
  readonly consumeVerificationCode: Pick<ConsumeVerificationCodeUseCase, "execute">;
  readonly securityLogRepository: Pick<SecurityLogRepositoryPort, "create">;
  readonly cacheService: Pick<UserProfileInvalidatorPort, "invalidateUserProfile">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLoggerPort;
}

export class SetPasswordUseCase {
  readonly #dependencies: SetPasswordDependencies;

  constructor(dependencies: SetPasswordDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SetPasswordCommand): Promise<{ message: string }> {
    const { code, newPassword, metadata } = input;
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

    const existingAccount = await this.#dependencies.accountRepository.findByUserIdAndProvider(
      userId,
      "CREDENTIAL",
    );
    if (existingAccount != null) {
      throw passwordAlreadySet(input.userId);
    }

    const hashedPassword = await this.#dependencies.passwordService.hash(newPassword);

    await this.#dependencies.unitOfWork.run(async () => {
      const lockedUser = await this.#dependencies.userRepository.findByIdForUpdate(userId);
      if (lockedUser == null) {
        throw userNotFound(input.userId);
      }
      if (lockedUser.isDeleted) {
        throw accountDeleted(lockedUser.id.value);
      }
      const currentAccount = await this.#dependencies.accountRepository.findByUserIdAndProvider(
        userId,
        "CREDENTIAL",
      );
      if (currentAccount != null) {
        throw passwordAlreadySet(input.userId);
      }
      await this.#dependencies.consumeVerificationCode.execute({
        userId: input.userId,
        code,
        type: "PASSWORD_SETUP",
      });

      await this.#dependencies.accountRepository.createCredentialAccount(userId, hashedPassword);

      await this.#dependencies.securityLogRepository.create({
        userId,
        event: SECURITY_EVENT.PASSWORD_SETUP,
        ipAddress: ip,
        userAgent,
      });
    });

    await this.#dependencies.cacheService.invalidateUserProfile(userId);
    this.#dependencies.logger.log({
      event: LinkedAccountsLogEvent.PASSWORD_SET,
      userId: input.userId,
    });

    return {
      message: "비밀번호가 설정되었습니다. 이제 이메일로 로그인할 수 있습니다.",
    };
  }
}
