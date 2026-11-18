import type { RequestMetadata } from "#api/modules/identity/shared/domain/request-metadata.constants";
import { REQUEST_ORIGIN_DEFAULTS } from "#api/modules/identity/shared/domain/request-metadata.constants";
import { accountDeleted } from "#api/modules/identity/users/application/users.errors";
import { SECURITY_EVENT } from "#api/modules/identity/users/domain/users.constants";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { SecurityLogRepositoryPort } from "../../../users/application/ports/security-log.repository.port.js";
import type { UserProfileInvalidatorPort } from "../../../users/application/ports/user-profile-invalidator.port.js";
import type { UserRepositoryPort } from "../../../users/application/ports/user.repository.port.js";
import { userNotFound } from "../../../users/application/users.errors.js";
import type { ConsumeVerificationCodeUseCase } from "../../../verifications/application/use-cases/consume-verification-code.use-case.js";
import { LinkedAccounts } from "../../domain/linked-accounts.aggregate.js";
import { accountAlreadyExists, passwordAlreadySet } from "../linked-accounts.errors.js";
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
  readonly userRepository: Pick<UserRepositoryPort, "findById" | "findByIdForUpdate">;
  readonly accountRepository: Pick<
    LinkedAccountsRepositoryPort,
    "findByUserId" | "nextId" | "save"
  >;
  readonly passwordService: Pick<PasswordHasherPort, "hash">;
  readonly consumeVerificationCode: Pick<ConsumeVerificationCodeUseCase, "execute">;
  readonly securityLogRepository: Pick<SecurityLogRepositoryPort, "create">;
  readonly cacheService: Pick<UserProfileInvalidatorPort, "invalidateUserProfile">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly clock: ClockPort;
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
    if (user.isDeleted()) {
      throw accountDeleted(user.id.value);
    }

    const { accountRepository } = this.#dependencies;
    if ((await accountRepository.findByUserId(userId))?.hasCredentialAccount()) {
      throw passwordAlreadySet(input.userId);
    }

    const hashedPassword = await this.#dependencies.passwordService.hash(newPassword);

    await this.#dependencies.unitOfWork.run(async () => {
      // 사용자 잠금(UserMutationLockPort와 같은 행 잠금)을 잡으며 그사이 탈퇴했는지 다시 본다
      const lockedUser = await this.#dependencies.userRepository.findByIdForUpdate(userId);
      if (lockedUser == null) {
        throw userNotFound(input.userId);
      }
      if (lockedUser.isDeleted()) {
        throw accountDeleted(lockedUser.id.value);
      }
      const accounts =
        (await accountRepository.findByUserId(userId)) ?? LinkedAccounts.create(userId);
      const passwordSet = accounts.setPassword({
        id: await accountRepository.nextId(),
        passwordHash: hashedPassword,
        now: this.#dependencies.clock.now(),
      });
      if (!passwordSet) {
        throw passwordAlreadySet(input.userId);
      }
      await this.#dependencies.consumeVerificationCode.execute({
        userId: input.userId,
        code,
        type: "PASSWORD_SETUP",
      });

      // Account_userId_provider_key·Account_provider_providerAccountId_key: 출시 앱이 받던 USER_0604
      if (!(await accountRepository.save(accounts))) {
        throw accountAlreadyExists();
      }

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
