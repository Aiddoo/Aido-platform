import type { EntitlementCacheInvalidatorPort } from "#api/modules/access/feature-grants/access-feature-grants-queries.public";
import type { LoginReadModel } from "#api/modules/identity/sessions/application/read-models/login.read-model";
import { LOGIN_FAILURE_REASON } from "#api/modules/identity/sessions/domain/sessions.constants";
import { LOGIN_ATTEMPT } from "#api/modules/identity/sessions/domain/sessions.constants";
import { Email } from "#api/modules/identity/shared/domain/email.vo";
import type { RequestMetadata } from "#api/modules/identity/shared/domain/request-metadata.constants";
import { REQUEST_ORIGIN_DEFAULTS } from "#api/modules/identity/shared/domain/request-metadata.constants";
import { assertStatusAllowsLogin } from "#api/modules/identity/users/domain/account-status.domain-service";
import { SECURITY_EVENT } from "#api/modules/identity/users/domain/users.constants";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { LinkedAccountsLogEvent } from "../../../linked-accounts/application/linked-accounts.log-events.js";
import type { LinkedAccountsRepositoryPort } from "../../../linked-accounts/application/ports/linked-accounts.repository.port.js";
import type { PasswordHasherPort } from "../../../linked-accounts/application/ports/password-hasher.port.js";
import type { SecurityLogRepositoryPort } from "../../../users/application/ports/security-log.repository.port.js";
import type { UserMutationLockPort } from "../../../users/application/ports/user-mutation-lock.port.js";
import type { UserProfileInvalidatorPort } from "../../../users/application/ports/user-profile-invalidator.port.js";
import type { UserRepositoryPort } from "../../../users/application/ports/user.repository.port.js";
import type { RestoreAccountUseCase } from "../../../users/application/use-cases/restore-account.use-case.js";
import { invalidCredentials } from "../../../users/application/users.errors.js";
import { UserLogEvent } from "../../../users/application/users.log-events.js";
import { accountLocked } from "../../../users/domain/users.errors.js";
import type { LoginAttemptRepositoryPort } from "../ports/login-attempt.repository.port.js";
import { emailNotVerified } from "../sessions.errors.js";
import { SessionLogEvent } from "../sessions.log-events.js";
import type { IssueLoginUseCase } from "./issue-login.use-case.js";

export interface LoginWithPasswordCommand {
  readonly email: string;
  readonly password: string;
  readonly deviceName?: string;
  readonly metadata?: RequestMetadata;
}

interface LoginWithPasswordDependencies {
  readonly userRepository: Pick<UserRepositoryPort, "findByEmail">;
  readonly accountRepository: Pick<LinkedAccountsRepositoryPort, "findByUserId" | "save">;
  readonly userMutationLock: Pick<UserMutationLockPort, "lockById">;
  readonly loginAttemptRepository: Pick<
    LoginAttemptRepositoryPort,
    "countRecentFailuresByEmail" | "create"
  >;
  readonly passwordService: Pick<PasswordHasherPort, "verify" | "needsRehash" | "hash">;
  readonly securityLogRepository: Pick<SecurityLogRepositoryPort, "create">;
  readonly issueLoginUseCase: Pick<IssueLoginUseCase, "execute">;
  readonly restoreAccount: Pick<RestoreAccountUseCase, "execute">;
  readonly cacheService: Pick<UserProfileInvalidatorPort, "invalidateUserProfile">;
  // 탈퇴 유예 중에는 권한을 무료로 캐시하므로 되살리면 함께 비운다
  readonly entitlementCache: Pick<EntitlementCacheInvalidatorPort, "invalidateEntitlements">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

export class LoginWithPasswordUseCase {
  readonly #dependencies: LoginWithPasswordDependencies;

  constructor(dependencies: LoginWithPasswordDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: LoginWithPasswordCommand): Promise<LoginReadModel> {
    const metadata = input.metadata;
    const { password, deviceName } = input;
    const email = Email.create(input.email).value;
    const ip = metadata?.ip ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_IP;
    const userAgent = metadata?.userAgent ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_USER_AGENT;
    const attemptContext = { email, ipAddress: ip, userAgent };

    const lockoutSince = this.#dependencies.clock
      .now()
      .subtract({ minutes: LOGIN_ATTEMPT.LOCKOUT_MINUTES });
    const recentFailures =
      await this.#dependencies.loginAttemptRepository.countRecentFailuresByEmail(
        email,
        lockoutSince,
      );

    if (recentFailures >= LOGIN_ATTEMPT.MAX_FAILURES) {
      await this.#dependencies.securityLogRepository.create({
        event: SECURITY_EVENT.ACCOUNT_LOCKED,
        ipAddress: ip,
        userAgent,
        metadata: { email, recentFailures },
      });

      throw accountLocked(email);
    }

    const user = await this.#dependencies.userRepository.findByEmail(email);
    if (user == null) {
      await this.#recordFailure({
        ...attemptContext,
        failureReason: LOGIN_FAILURE_REASON.USER_NOT_FOUND,
      });
      throw invalidCredentials();
    }

    const accounts = await this.#dependencies.accountRepository.findByUserId(user.id);
    const passwordHash = accounts?.passwordHash;
    if (accounts == null || passwordHash == null || !accounts.hasPassword()) {
      await this.#recordFailure({
        ...attemptContext,
        failureReason: LOGIN_FAILURE_REASON.NO_CREDENTIAL_ACCOUNT,
      });
      throw invalidCredentials();
    }

    const isPasswordValid = await this.#dependencies.passwordService.verify(passwordHash, password);
    if (!isPasswordValid) {
      await this.#recordFailure({
        ...attemptContext,
        failureReason: LOGIN_FAILURE_REASON.INVALID_PASSWORD,
      });

      const remainingAttempts = LOGIN_ATTEMPT.MAX_FAILURES - recentFailures - 1;
      if (remainingAttempts <= 0) {
        throw accountLocked(email);
      }

      throw invalidCredentials();
    }

    if (this.#dependencies.passwordService.needsRehash(passwordHash)) {
      // 응답과 따로 다시 만들고, 그사이 비밀번호가 바뀌었으면 저장이 false라 새 비밀번호를 덮지 않는다
      this.#dependencies.passwordService
        .hash(password)
        .then((rehashed) => {
          accounts.changePassword(rehashed, this.#dependencies.clock.now());
          return this.#dependencies.unitOfWork.run(
            async () =>
              (await this.#dependencies.userMutationLock.lockById(user.id)) &&
              this.#dependencies.accountRepository.save(accounts),
          );
        })
        .then((updated) => {
          if (updated) {
            this.#dependencies.logger.debug({
              event: LinkedAccountsLogEvent.PASSWORD_REHASHED,
              userId: user.id.value,
            });
          }
        })
        .catch((error: unknown) =>
          this.#dependencies.logger.error({
            event: LinkedAccountsLogEvent.PASSWORD_REHASH_FAILED,
            userId: user.id.value,
            errorType: error instanceof Error ? error.name : "unknown",
          }),
        );
    }

    const identityUser = user;
    const restorationAt = this.#dependencies.clock.now();
    const needsRestore = identityUser.requiresRestoration(restorationAt);

    if (!needsRestore) {
      if (user.status === "PENDING_VERIFY") {
        throw emailNotVerified(email);
      }
      assertStatusAllowsLogin(user.status, email);
    }

    const result = await this.#dependencies.unitOfWork.run(async () => {
      if (needsRestore) {
        await this.#dependencies.restoreAccount.execute({
          user: identityUser,
          metadata: { ip, userAgent },
          at: restorationAt,
        });
      }

      return this.#dependencies.issueLoginUseCase.execute({
        userId: user.id.value,
        email,
        role: user.role,
        provider: "CREDENTIAL",
        ip,
        userAgent,
        deviceFingerprint: deviceName ?? userAgent,
      });
    });

    if (needsRestore) {
      await Promise.all([
        this.#dependencies.cacheService.invalidateUserProfile(user.id),
        this.#dependencies.entitlementCache.invalidateEntitlements(user.id),
      ]);
      this.#dependencies.logger.log({
        event: UserLogEvent.ACCOUNT_RESTORED,
        userId: user.id.value,
        provider: "CREDENTIAL",
      });
    }

    this.#dependencies.logger.log({
      event: SessionLogEvent.USER_LOGGED_IN,
      userId: user.id.value,
      provider: "CREDENTIAL",
    });

    return {
      userId: user.id.value,
      userTag: user.userTag,
      tokens: result.tokens,
      sessionId: result.sessionId,
      name: result.name,
      profileImage: result.profileImage,
      accountRestored: needsRestore,
    };
  }

  async #recordFailure(input: {
    readonly email: string;
    readonly ipAddress: string;
    readonly userAgent: string;
    readonly failureReason: string;
  }): Promise<void> {
    await this.#dependencies.loginAttemptRepository.create({
      ...input,
      provider: "CREDENTIAL",
      success: false,
      attemptedAt: this.#dependencies.clock.now(),
    });
  }
}
