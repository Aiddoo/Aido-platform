import { LOGIN_ATTEMPT, type LoginInput as LoginBody } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type {
  LoginResult,
  RequestMetadata,
} from "#api/modules/identity/application/types/auth/index";
import { IdentityUser } from "#api/modules/identity/domain/aggregates/auth/identity-user.aggregate";
import {
  AUTH_DEFAULTS,
  LOGIN_FAILURE_REASON,
  SECURITY_EVENT,
} from "#api/modules/identity/domain/constants/auth/auth.constants";
import { assertStatusAllowsLogin } from "#api/modules/identity/domain/services/auth/account-status-policy";
import { Email } from "#api/modules/identity/domain/value-objects/auth/email.vo";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { subtractMinutes } from "#api/shared/domain/date/utils/arithmetic";
import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { IdentityLogEvent } from "../../observability/auth/identity-log.events.js";
import type { AuthCachePort } from "../../ports/auth/auth-collaboration.port.js";
import type { AuthPasswordHasherPort } from "../../ports/auth/auth-crypto.port.js";
import type {
  AuthUserRepositoryPort,
  AuthAccountRepositoryPort,
  AuthLoginAttemptRepositoryPort,
  AuthSecurityLogRepositoryPort,
} from "../../ports/auth/auth-persistence.port.js";
import type { IssueLogin } from "./issue-login.use-case.js";
import type { RestoreAccount } from "./restore-account.use-case.js";

export type LoginWithPasswordInput = Readonly<LoginBody> & { readonly metadata?: RequestMetadata };

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
  readonly issueLoginUseCase: Pick<IssueLogin, "execute">;
  readonly restoreAccount: Pick<RestoreAccount, "execute">;
  readonly cacheService: Pick<AuthCachePort, "invalidateUserProfile">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLogger;
}

export class LoginWithPassword {
  readonly #dependencies: LoginWithPasswordDependencies;

  constructor(dependencies: LoginWithPasswordDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: LoginWithPasswordInput): Promise<LoginResult> {
    const metadata = input.metadata;
    const { password, deviceName } = input;
    const email = Email.of(input.email).value;
    const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
    const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;
    const attemptContext = { email, ipAddress: ip, userAgent };

    const lockoutSince = subtractMinutes(LOGIN_ATTEMPT.LOCKOUT_MINUTES);
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
    if (user === null) {
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
    if (account === null || account.password === null || account.password === "") {
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
              event: IdentityLogEvent.PASSWORD_REHASHED,
              userId: user.id,
            });
          }
        })
        .catch((error: unknown) =>
          this.#dependencies.logger.error({
            event: IdentityLogEvent.PASSWORD_REHASH_FAILED,
            userId: user.id,
            errorType: error instanceof Error ? error.name : "unknown",
          }),
        );
    }

    const identityUser = IdentityUser.reconstitute(user);
    const restorationAt = now();
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
        userId: user.id,
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
        event: IdentityLogEvent.ACCOUNT_RESTORED,
        userId: user.id,
        provider: "CREDENTIAL",
      });
    }

    this.#dependencies.logger.log({
      event: IdentityLogEvent.USER_LOGGED_IN,
      userId: user.id,
      provider: "CREDENTIAL",
    });

    return {
      userId: user.id,
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
    });
  }
}
