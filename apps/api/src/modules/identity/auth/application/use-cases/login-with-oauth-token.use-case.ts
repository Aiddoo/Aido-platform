import { ErrorCode } from "@aido/api/errors";
import { type OAUTH_PROVIDERS, TERMS_VERSION, SECURITY_EVENT } from "@aido/api/vocabulary";

import {
  AuthPersistenceConflict,
  oauthAccountAlreadyLinked,
} from "#api/modules/identity/auth/application/auth.errors";
import {
  AUTH_DEFAULTS,
  LOGIN_FAILURE_REASON,
  TRUSTED_EMAIL_PROVIDERS,
  type AccountProvider,
} from "#api/modules/identity/auth/domain/auth.constants";
import { generateRandomName } from "#api/modules/identity/auth/domain/random-name.domain-service";
import { assertStatusAllowsLogin } from "#api/modules/identity/users/domain/account-status.domain-service";
import type { IdentityUser } from "#api/modules/identity/users/domain/identity-user.aggregate";
import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import type { SupportedLocale } from "#api/shared/domain/locale";

import { AuthLogEvent } from "../auth.log-events.js";
import type { AuthAccountRepositoryPort } from "../ports/auth-account.repository.port.js";
import type { AuthCachePort } from "../ports/auth-collaboration.port.js";
import type { AuthLoginAttemptRepositoryPort } from "../ports/auth-login-attempt.repository.port.js";
import type { AuthSecurityLogRepositoryPort } from "../ports/auth-security-log.repository.port.js";
import type { AuthUserRepositoryPort } from "../ports/auth-user.repository.port.js";
import type {
  OAuthIdentityProviderRegistryPort,
  SocialLoginOptions,
  VerifiedProfile,
} from "../ports/oauth-identity-provider.port.js";
import type {
  LoginResult,
  RequestMetadata,
  SocialLoginResult,
} from "../read-models/auth-result.read-model.js";
import type { IssueLoginUseCase } from "./issue-login.use-case.js";
import type { ProvisionUserUseCase } from "./provision-user.use-case.js";
import type { RestoreAccountUseCase } from "./restore-account.use-case.js";

export interface LoginWithOAuthTokenCommand {
  readonly provider: (typeof OAUTH_PROVIDERS)[number];
  readonly token: string;
  readonly userName?: string;
  readonly metadata?: RequestMetadata;
  readonly nonce?: string;
}

interface LoginWithOAuthTokenDependencies {
  readonly registry: Pick<OAuthIdentityProviderRegistryPort, "get">;
  readonly userRepository: Pick<
    AuthUserRepositoryPort,
    "findById" | "findByEmail" | "findByIdForUpdate"
  >;
  readonly accountRepository: Pick<
    AuthAccountRepositoryPort,
    "findByProviderAccountId" | "createOAuthAccount"
  >;
  readonly securityLogRepository: Pick<AuthSecurityLogRepositoryPort, "create">;
  readonly loginAttemptRepository: Pick<AuthLoginAttemptRepositoryPort, "create">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly cacheService: Pick<AuthCachePort, "invalidateUserProfile">;
  readonly issueLoginUseCase: Pick<IssueLoginUseCase, "execute">;
  readonly provisionUserUseCase: Pick<ProvisionUserUseCase, "execute">;
  readonly restoreAccount: Pick<RestoreAccountUseCase, "execute">;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

export class LoginWithOAuthTokenUseCase {
  readonly #dependencies: LoginWithOAuthTokenDependencies;

  constructor(dependencies: LoginWithOAuthTokenDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: LoginWithOAuthTokenCommand): Promise<SocialLoginResult> {
    const strategy = this.#dependencies.registry.get(input.provider);
    if (strategy == null) {
      throw new ApplicationException(ErrorCode.SOCIAL_0204, {
        provider: input.provider,
        reason: `Unsupported provider: ${input.provider}`,
      });
    }
    let profile: VerifiedProfile;
    let options: SocialLoginOptions;
    try {
      profile = await strategy.verifyToken(
        input.token,
        input.provider === "APPLE" ? input.nonce : undefined,
      );
      options = strategy.buildLoginOptions(profile, input.userName);
    } catch (error) {
      await this.#dependencies.loginAttemptRepository.create({
        email: strategy.failureEmail,
        provider: input.provider,
        ipAddress: input.metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP,
        userAgent: input.metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
        success: false,
        failureReason: LOGIN_FAILURE_REASON.OAUTH_TOKEN_INVALID,
        attemptedAt: this.#dependencies.clock.now(),
      });
      throw error;
    }
    return this.#handleSocialLogin(input.provider, profile.id, profile.email ?? undefined, {
      ...options,
      metadata: input.metadata,
    });
  }

  async #handleSocialLogin(
    provider: AccountProvider,
    providerAccountId: string,
    email: string | undefined,
    options: {
      userName?: string;
      emailVerified?: boolean;
      profileImage?: string;
      metadata?: RequestMetadata;
    },
  ): Promise<SocialLoginResult> {
    const ip = options.metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
    const userAgent = options.metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

    const existingAccount = await this.#dependencies.accountRepository.findByProviderAccountId(
      provider,
      providerAccountId,
    );

    let userId: string;
    let userEmail: string;
    let isNewUser = false;

    if (existingAccount != null) {
      userId = existingAccount.userId;
      const user = await this.#dependencies.userRepository.findById(userId);

      if (user == null) {
        throw new ApplicationException(ErrorCode.USER_0601, { userId });
      }

      const restorationAt = this.#dependencies.clock.now();
      if (user.requiresRestoration(restorationAt)) {
        const loginResult = await this.#restoreAndCreateSession(user, {
          ip,
          userAgent,
          provider,
          restorationAt,
        });
        return { ...loginResult, accountRestored: true, isNewUser: false };
      }

      this.#validateUserStatus(user.status);
      userEmail = user.email;

      this.#dependencies.logger.debug({
        event: AuthLogEvent.OAUTH_EXISTING_USER_AUTHENTICATED,
        userId,
        provider,
      });
    } else {
      const effectiveEmail =
        email ?? `${provider.toLowerCase()}_${providerAccountId}@social.aido.kr`;

      if (email) {
        const existingUser = await this.#dependencies.userRepository.findByEmail(email);
        if (existingUser != null) {
          const loginResult = await this.#handleEmailConflict(
            existingUser,
            provider,
            providerAccountId,
            { emailVerified: options.emailVerified, ip, userAgent },
          );
          return { ...loginResult, isNewUser: false };
        }
      }

      const newUser = await this.#createSocialUser({
        email: effectiveEmail,
        provider,
        providerAccountId,
        userName: options.userName,
        profileImage: options.profileImage,
        locale: options.metadata?.locale,
      });

      userId = newUser.id;
      userEmail = effectiveEmail;
      isNewUser = true;

      this.#dependencies.logger.log({ event: AuthLogEvent.USER_REGISTERED, userId, provider });
    }

    const loginResult = await this.#createSessionAndTokens(userId, userEmail, {
      ip,
      userAgent,
      provider,
    });
    return { ...loginResult, isNewUser };
  }

  async #createSocialUser(data: {
    email: string;
    provider: AccountProvider;
    providerAccountId: string;
    userName?: string;
    profileImage?: string;
    locale?: SupportedLocale;
  }) {
    return this.#dependencies.unitOfWork.run(async () => {
      const maximumNameLength = 20;
      const effectiveName = data.userName
        ? data.userName.slice(0, maximumNameLength)
        : generateRandomName();
      const currentTime = this.#dependencies.clock.now();

      const user = await this.#dependencies.provisionUserUseCase.execute({
        email: data.email,
        status: "ACTIVE",
        emailVerifiedAt: currentTime,
        account: {
          kind: "oauth",
          provider: data.provider,
          providerAccountId: data.providerAccountId,
        },
        profile: { name: effectiveName, profileImage: data.profileImage },
        consent: {
          termsAgreedAt: currentTime,
          privacyAgreedAt: currentTime,
          agreedTermsVersion: TERMS_VERSION.CURRENT,
          // OAuth 가입 시 선택 동의 화면이 없으므로 마케팅 동의를 자동 처리하지 않는다.
        },
        locale: data.locale,
      });

      await this.#dependencies.securityLogRepository.create({
        userId: user.id,
        event: SECURITY_EVENT.REGISTRATION,
        ipAddress: AUTH_DEFAULTS.UNKNOWN_IP,
        userAgent: AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
        metadata: { provider: data.provider },
      });

      return { id: user.id, name: effectiveName };
    });
  }

  async #linkOAuthAccount(
    userId: string,
    provider: AccountProvider,
    providerAccountId: string,
    options: { ip: string; userAgent: string },
  ): Promise<void> {
    await this.#dependencies.userRepository.findByIdForUpdate(userId);
    try {
      await this.#dependencies.accountRepository.createOAuthAccount({
        userId,
        provider,
        providerAccountId,
      });
    } catch (error) {
      // 같은 자동 연결 요청이 동시에 오면 User 잠금 뒤 두 번째 INSERT가 제약에 걸린다
      if (
        error instanceof AuthPersistenceConflict &&
        error.kind === "OAUTH_ACCOUNT_ALREADY_LINKED"
      ) {
        throw oauthAccountAlreadyLinked(provider, providerAccountId);
      }
      throw error;
    }

    await this.#dependencies.securityLogRepository.create({
      userId,
      event: SECURITY_EVENT.OAUTH_AUTO_LINKED,
      ipAddress: options.ip,
      userAgent: options.userAgent,
      metadata: {
        provider,
        autoLinked: true,
        reason: "trusted_provider_verified_email",
      },
    });
  }

  async #restoreAndCreateSession(
    user: IdentityUser,
    options: {
      ip: string;
      userAgent: string;
      provider: AccountProvider;
      restorationAt: Temporal.Instant;
    },
    onLinkInTransaction?: () => Promise<void>,
  ): Promise<LoginResult> {
    const userId = user.id.value;
    // 복구와 발급 사이에 역할이 바뀌었을 수 있어 최신 행의 역할로 토큰을 만든다
    const latest = await this.#dependencies.userRepository.findById(userId);
    if (latest == null) {
      throw new ApplicationException(ErrorCode.USER_0601, { userId });
    }
    const result = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.restoreAccount.execute({
        user,
        metadata: { ip: options.ip, userAgent: options.userAgent },
        at: options.restorationAt,
      });

      const outcome = await this.#dependencies.issueLoginUseCase.execute({
        userId,
        email: user.email,
        role: latest.role,
        provider: options.provider,
        ip: options.ip,
        userAgent: options.userAgent,
        deviceFingerprint: options.userAgent,
        securityMetadata: { provider: options.provider },
      });

      if (onLinkInTransaction) {
        await onLinkInTransaction();
      }

      return {
        userId,
        userTag: outcome.userTag,
        tokens: outcome.tokens,
        sessionId: outcome.sessionId,
        name: outcome.name,
        profileImage: outcome.profileImage,
      };
    });

    await this.#dependencies.cacheService.invalidateUserProfile(userId);
    this.#dependencies.logger.log({
      event: AuthLogEvent.ACCOUNT_RESTORED,
      userId,
      provider: options.provider,
    });

    return result;
  }

  async #createSessionAndTokens(
    userId: string,
    email: string,
    options: {
      ip: string;
      userAgent: string;
      provider: AccountProvider;
    },
  ): Promise<LoginResult> {
    const user = await this.#dependencies.userRepository.findById(userId);

    if (user == null) {
      throw new ApplicationException(ErrorCode.USER_0601, { userId });
    }

    return this.#dependencies.unitOfWork.run(async () => {
      const outcome = await this.#dependencies.issueLoginUseCase.execute({
        userId,
        email,
        role: user.role,
        provider: options.provider,
        ip: options.ip,
        userAgent: options.userAgent,
        deviceFingerprint: options.userAgent,
        securityMetadata: { provider: options.provider },
      });

      return {
        userId,
        userTag: outcome.userTag,
        tokens: outcome.tokens,
        sessionId: outcome.sessionId,
        name: outcome.name,
        profileImage: outcome.profileImage,
      };
    });
  }

  #validateUserStatus(status: string): void {
    assertStatusAllowsLogin(status, "Social login user");
  }

  #isTrustedProvider(provider: AccountProvider): boolean {
    return TRUSTED_EMAIL_PROVIDERS.includes(provider);
  }

  async #handleEmailConflict(
    existingUser: IdentityUser,
    provider: AccountProvider,
    providerAccountId: string,
    options: {
      emailVerified?: boolean;
      ip: string;
      userAgent: string;
    },
  ): Promise<LoginResult> {
    const restorationAt = this.#dependencies.clock.now();
    const needsRestore = existingUser.requiresRestoration(restorationAt);

    const isTrusted = this.#isTrustedProvider(provider);
    const isEmailVerified = options.emailVerified === true;

    if (isTrusted && isEmailVerified) {
      this.#dependencies.logger.log({
        event: AuthLogEvent.OAUTH_ACCOUNT_AUTO_LINKING,
        userId: existingUser.id.value,
        provider,
      });

      if (!needsRestore) {
        this.#validateUserStatus(existingUser.status);
      }

      if (needsRestore) {
        const loginResult = await this.#restoreAndCreateSession(
          existingUser,
          { ip: options.ip, userAgent: options.userAgent, provider, restorationAt },
          () =>
            this.#linkOAuthAccount(existingUser.id.value, provider, providerAccountId, {
              ip: options.ip,
              userAgent: options.userAgent,
            }),
        );

        return { ...loginResult, accountRestored: true };
      }

      const loginResult = await this.#dependencies.unitOfWork.run(async () => {
        await this.#linkOAuthAccount(existingUser.id.value, provider, providerAccountId, {
          ip: options.ip,
          userAgent: options.userAgent,
        });

        return this.#createSessionAndTokens(existingUser.id.value, existingUser.email, {
          ip: options.ip,
          userAgent: options.userAgent,
          provider,
        });
      });
      await this.#dependencies.cacheService.invalidateUserProfile(existingUser.id.value);
      return loginResult;
    }

    this.#dependencies.logger.warn({
      event: AuthLogEvent.OAUTH_ACCOUNT_LINK_REQUIRED,
      userId: existingUser.id.value,
      provider,
    });

    await this.#dependencies.securityLogRepository.create({
      userId: existingUser.id.value,
      event: SECURITY_EVENT.OAUTH_LINK_REQUIRED,
      ipAddress: options.ip,
      userAgent: options.userAgent,
      metadata: {
        provider,
        reason: isTrusted ? "email_not_verified" : "untrusted_provider",
      },
    });

    throw new ApplicationException(ErrorCode.SOCIAL_0206, {
      provider,
      providerAccountId,
      email: existingUser.email,
    });
  }
}
