import { ErrorCode } from "@aido/api/errors";
import { LOGIN_ATTEMPT, SECURITY_EVENT } from "@aido/api/vocabulary";

import type {
  LoginResult,
  RequestMetadata,
} from "#api/modules/identity/auth/application/read-models/auth-result.read-model";
import {
  AUTH_DEFAULTS,
  LOGIN_FAILURE_REASON,
} from "#api/modules/identity/auth/domain/auth.constants";
import { Email } from "#api/modules/identity/auth/domain/email.vo";
import { assertStatusAllowsLogin } from "#api/modules/identity/users/domain/account-status.domain-service";
import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { AuthLogEvent } from "../auth.log-events.js";
import type { AuthAccountRepositoryPort } from "../ports/auth-account.repository.port.js";
import type { AuthCachePort } from "../ports/auth-collaboration.port.js";
import type { AuthPasswordHasherPort } from "../ports/auth-crypto.port.js";
import type { AuthLoginAttemptRepositoryPort } from "../ports/auth-login-attempt.repository.port.js";
import type { AuthSecurityLogRepositoryPort } from "../ports/auth-security-log.repository.port.js";
import type { AuthUserRepositoryPort } from "../ports/auth-user.repository.port.js";
import type { IssueLoginUseCase } from "./issue-login.use-case.js";
import type { RestoreAccountUseCase } from "./restore-account.use-case.js";

export interface LoginWithPasswordCommand {
  readonly email: string;
  readonly password: string;
  readonly deviceName?: string;
  readonly metadata?: RequestMetadata;
}

interface LoginWithPasswordDependencies {
  readonly userRepository: Pick<AuthUserRepositoryPort, "findByEmail">;
  readonly accountRepository: Pick<
    AuthAccountRepositoryPort,
    "findByUserIdAndProvider" | "updatePasswordIfUnchanged"
  >;
  readonly loginAttemptRepository: Pick<
    AuthLoginAttemptRepositoryPort,
    "countRecentFailuresByEmail" | "create"
  >;
  readonly passwordService: Pick<AuthPasswordHasherPort, "verify" | "needsRehash" | "hash">;
  readonly securityLogRepository: Pick<AuthSecurityLogRepositoryPort, "create">;
  readonly issueLoginUseCase: Pick<IssueLoginUseCase, "execute">;
  readonly restoreAccount: Pick<RestoreAccountUseCase, "execute">;
  readonly cacheService: Pick<AuthCachePort, "invalidateUserProfile">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

export class LoginWithPasswordUseCase {
  readonly #dependencies: LoginWithPasswordDependencies;

  constructor(dependencies: LoginWithPasswordDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: LoginWithPasswordCommand): Promise<LoginResult> {
    const metadata = input.metadata;
    const { password, deviceName } = input;
    const email = Email.create(input.email).value;
    const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
    const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;
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

      throw new ApplicationException(ErrorCode.USER_0607, {
        email,
        remainingMinutes: undefined,
      });
    }

    const user = await this.#dependencies.userRepository.findByEmail(email);
    if (user == null) {
      await this.#recordFailure({
        ...attemptContext,
        failureReason: LOGIN_FAILURE_REASON.USER_NOT_FOUND,
      });
      throw new ApplicationException(ErrorCode.USER_0602);
    }

    const account = await this.#dependencies.accountRepository.findByUserIdAndProvider(
      user.id,
      "CREDENTIAL",
    );
    if (account == null || account.password == null || account.password === "") {
      await this.#recordFailure({
        ...attemptContext,
        failureReason: LOGIN_FAILURE_REASON.NO_CREDENTIAL_ACCOUNT,
      });
      throw new ApplicationException(ErrorCode.USER_0602);
    }

    const isPasswordValid = await this.#dependencies.passwordService.verify(
      account.password,
      password,
    );
    if (!isPasswordValid) {
      await this.#recordFailure({
        ...attemptContext,
        failureReason: LOGIN_FAILURE_REASON.INVALID_PASSWORD,
      });

      const remainingAttempts = LOGIN_ATTEMPT.MAX_FAILURES - recentFailures - 1;
      if (remainingAttempts <= 0) {
        throw new ApplicationException(ErrorCode.USER_0607, {
          email,
          remainingMinutes: undefined,
        });
      }

      throw new ApplicationException(ErrorCode.USER_0602);
    }

    const expectedPasswordHash = account.password;
    if (this.#dependencies.passwordService.needsRehash(expectedPasswordHash)) {
      this.#dependencies.passwordService
        .hash(password)
        .then((passwordHash) =>
          this.#dependencies.accountRepository.updatePasswordIfUnchanged(
            user.id,
            expectedPasswordHash,
            passwordHash,
          ),
        )
        .then((updated) => {
          if (updated) {
            this.#dependencies.logger.debug({
              event: AuthLogEvent.PASSWORD_REHASHED,
              userId: user.id.value,
            });
          }
        })
        .catch((error: unknown) =>
          this.#dependencies.logger.error({
            event: AuthLogEvent.PASSWORD_REHASH_FAILED,
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
        throw new ApplicationException(ErrorCode.EMAIL_0503, { email });
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
      await this.#dependencies.cacheService.invalidateUserProfile(user.id);
      this.#dependencies.logger.log({
        event: AuthLogEvent.ACCOUNT_RESTORED,
        userId: user.id.value,
        provider: "CREDENTIAL",
      });
    }

    this.#dependencies.logger.log({
      event: AuthLogEvent.USER_LOGGED_IN,
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
