import {
  type OAUTH_PROVIDERS,
  resolveSupportedLocale,
  type SupportedLocale,
} from "@aido/api/vocabulary";

import type { EntitlementCacheInvalidatorPort } from "#api/modules/access/feature-grants/access-feature-grants.public";
import { LinkedAccounts } from "#api/modules/identity/linked-accounts/domain/linked-accounts.aggregate";
import {
  TRUSTED_EMAIL_PROVIDERS,
  type AccountProvider,
} from "#api/modules/identity/linked-accounts/domain/linked-accounts.constants";
import { oauthAccountAlreadyLinked } from "#api/modules/identity/linked-accounts/domain/linked-accounts.errors";
import { LOGIN_FAILURE_REASON } from "#api/modules/identity/sessions/domain/sessions.constants";
import {
  IdentityPersistenceConflict,
  oauthAccountLinkConflict,
} from "#api/modules/identity/shared/domain/identity.errors";
import { REQUEST_ORIGIN_DEFAULTS } from "#api/modules/identity/shared/domain/request-metadata.constants";
import { emailAlreadyRegistered } from "#api/modules/identity/users/application/users.errors";
import { assertStatusAllowsLogin } from "#api/modules/identity/users/domain/account-status.domain-service";
import { generateRandomName } from "#api/modules/identity/users/domain/random-name.domain-service";
import type { User } from "#api/modules/identity/users/domain/user.aggregate";
import { TERMS_VERSION, SECURITY_EVENT } from "#api/modules/identity/users/domain/users.constants";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { unsupportedOAuthProvider } from "../../../linked-accounts/application/linked-accounts.errors.js";
import type { LinkedAccountsRepositoryPort } from "../../../linked-accounts/application/ports/linked-accounts.repository.port.js";
import type {
  OAuthIdentityProviderRegistryPort,
  SocialLoginOptions,
  VerifiedProfile,
} from "../../../linked-accounts/application/ports/oauth-identity-provider.port.js";
import type { RequestMetadata } from "../../../shared/domain/request-metadata.constants.js";
import type { SecurityLogRepositoryPort } from "../../../users/application/ports/security-log.repository.port.js";
import type { UserMutationLockPort } from "../../../users/application/ports/user-mutation-lock.port.js";
import type { UserProfileInvalidatorPort } from "../../../users/application/ports/user-profile-invalidator.port.js";
import type { UserRepositoryPort } from "../../../users/application/ports/user.repository.port.js";
import type { ProvisionUserUseCase } from "../../../users/application/use-cases/provision-user.use-case.js";
import type { RestoreAccountUseCase } from "../../../users/application/use-cases/restore-account.use-case.js";
import { userNotFound } from "../../../users/application/users.errors.js";
import { UserLogEvent } from "../../../users/application/users.log-events.js";
import type { LoginAttemptRepositoryPort } from "../ports/login-attempt.repository.port.js";
import type { LoginReadModel, SocialLoginReadModel } from "../read-models/login.read-model.js";
import { oauthAccountNotLinked } from "../sessions.errors.js";
import { SessionLogEvent } from "../sessions.log-events.js";
import type { IssueLoginUseCase } from "./issue-login.use-case.js";

export interface LoginWithOAuthTokenCommand {
  readonly provider: (typeof OAUTH_PROVIDERS)[number];
  readonly token: string;
  readonly userName?: string;
  readonly metadata?: RequestMetadata;
  readonly nonce?: string;
}

interface LoginWithOAuthTokenDependencies {
  readonly registry: Pick<OAuthIdentityProviderRegistryPort, "get">;
  readonly userRepository: Pick<UserRepositoryPort, "findById" | "findByEmail">;
  readonly userMutationLock: Pick<UserMutationLockPort, "lockById">;
  readonly accountRepository: Pick<
    LinkedAccountsRepositoryPort,
    "findUserIdByProviderAccountId" | "findByUserId" | "nextId" | "save"
  >;
  readonly securityLogRepository: Pick<SecurityLogRepositoryPort, "create">;
  readonly loginAttemptRepository: Pick<LoginAttemptRepositoryPort, "create">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly cacheService: Pick<UserProfileInvalidatorPort, "invalidateUserProfile">;
  // 탈퇴 유예 중에는 권한을 무료로 캐시하므로 되살리면 함께 비운다
  readonly entitlementCache: Pick<EntitlementCacheInvalidatorPort, "invalidateEntitlements">;
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

  async execute(input: LoginWithOAuthTokenCommand): Promise<SocialLoginReadModel> {
    const strategy = this.#dependencies.registry.get(input.provider);
    if (strategy == null) {
      throw unsupportedOAuthProvider(input.provider);
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
        ipAddress: input.metadata?.ip ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_IP,
        userAgent: input.metadata?.userAgent ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_USER_AGENT,
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
  ): Promise<SocialLoginReadModel> {
    const { accountRepository, userRepository, logger } = this.#dependencies;
    const ip = options.metadata?.ip ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_IP;
    const userAgent = options.metadata?.userAgent ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_USER_AGENT;
    const request = { ip, userAgent, provider };

    const linkedUserId = await accountRepository.findUserIdByProviderAccountId(
      provider,
      providerAccountId,
    );
    if (linkedUserId != null) {
      return this.#loginLinkedUser(linkedUserId.value, request);
    }

    if (email) {
      const existingUser = await userRepository.findByEmail(email);
      if (existingUser != null) {
        try {
          const loginResult = await this.#handleEmailConflict(
            existingUser,
            provider,
            providerAccountId,
            { emailVerified: options.emailVerified, ip, userAgent },
          );
          return { ...loginResult, isNewUser: false };
        } catch (error) {
          const linkedMeanwhile = await this.#findUserLinkedMeanwhile(
            error,
            provider,
            providerAccountId,
          );
          // 이 사용자에게 같은 공급자의 다른 계정이 있거나 다른 사용자에게 연결됐으면 진짜 충돌이다
          if (linkedMeanwhile == null || !linkedMeanwhile.equals(existingUser.id)) {
            throw oauthAccountAlreadyLinked(provider, providerAccountId);
          }
          return this.#loginLinkedUser(existingUser.id.value, request);
        }
      }
    }

    const effectiveEmail = email ?? `${provider.toLowerCase()}_${providerAccountId}@social.aido.kr`;
    let newUser: { id: string };
    try {
      newUser = await this.#createSocialUser({
        email: effectiveEmail,
        provider,
        providerAccountId,
        userName: options.userName,
        profileImage: options.profileImage,
        // 언어를 보내지 않은 가입 요청은 옛 앱이라 한국어 카테고리로 시작한다
        locale: resolveSupportedLocale(options.metadata?.locale),
      });
    } catch (error) {
      const linkedMeanwhile = await this.#findUserLinkedMeanwhile(
        error,
        provider,
        providerAccountId,
      );
      if (linkedMeanwhile == null) {
        // 그사이 다른 가입이 이메일을 가져갔다. 1.15.0이 User_email_key 제약에 주던 응답이다
        throw emailAlreadyRegistered(effectiveEmail);
      }
      return this.#loginLinkedUser(linkedMeanwhile.value, request);
    }
    logger.log({ event: UserLogEvent.USER_REGISTERED, userId: newUser.id, provider });

    const loginResult = await this.#createSessionAndTokens(newUser.id, effectiveEmail, request);
    return { ...loginResult, isNewUser: true };
  }

  async #loginLinkedUser(
    userId: string,
    request: { ip: string; userAgent: string; provider: AccountProvider },
  ): Promise<SocialLoginReadModel> {
    const user = await this.#dependencies.userRepository.findById(UserId.reconstitute(userId));
    if (user == null) {
      throw userNotFound(userId);
    }

    const restorationAt = this.#dependencies.clock.now();
    if (user.requiresRestoration(restorationAt)) {
      const loginResult = await this.#restoreAndCreateSession(user, { ...request, restorationAt });
      return { ...loginResult, accountRestored: true, isNewUser: false };
    }

    this.#validateUserStatus(user.status);
    this.#dependencies.logger.debug({
      event: SessionLogEvent.OAUTH_EXISTING_USER_AUTHENTICATED,
      userId,
      provider: request.provider,
    });
    const loginResult = await this.#createSessionAndTokens(userId, user.email, request);
    return { ...loginResult, isNewUser: false };
  }

  // 같은 공급자 계정의 첫 로그인이 동시에 오면 늦은 요청은 사용자·계정 INSERT의 유일 제약에 걸린다.
  // 먼저 커밋한 요청이 만든 연결을 한 번만 다시 읽어 그 사용자로 이어서 로그인하게 한다
  async #findUserLinkedMeanwhile(
    error: unknown,
    provider: AccountProvider,
    providerAccountId: string,
  ): Promise<UserId | null> {
    if (!(error instanceof IdentityPersistenceConflict)) {
      throw error;
    }
    return this.#dependencies.accountRepository.findUserIdByProviderAccountId(
      provider,
      providerAccountId,
    );
  }

  async #createSocialUser(data: {
    email: string;
    provider: AccountProvider;
    providerAccountId: string;
    userName?: string;
    profileImage?: string;
    locale: SupportedLocale;
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
        userId: UserId.reconstitute(user.id),
        event: SECURITY_EVENT.REGISTRATION,
        ipAddress: REQUEST_ORIGIN_DEFAULTS.UNKNOWN_IP,
        userAgent: REQUEST_ORIGIN_DEFAULTS.UNKNOWN_USER_AGENT,
        metadata: { provider: data.provider },
      });

      return { id: user.id, name: effectiveName };
    });
  }

  async #linkOAuthAccount(
    userId: UserId,
    provider: AccountProvider,
    providerAccountId: string,
    options: { ip: string; userAgent: string },
  ): Promise<void> {
    const { accountRepository, userMutationLock } = this.#dependencies;
    if (!(await userMutationLock.lockById(userId))) {
      throw userNotFound(userId.value);
    }
    const accounts =
      (await accountRepository.findByUserId(userId)) ?? LinkedAccounts.create(userId);
    const linked = accounts.link({
      id: await accountRepository.nextId(),
      provider,
      providerAccountId,
      now: this.#dependencies.clock.now(),
    });
    // 같은 자동 연결 로그인이 먼저 커밋했으면 이미 연결돼 있어 그대로 로그인한다
    if (!linked) {
      return;
    }
    if (!(await accountRepository.save(accounts))) {
      throw oauthAccountLinkConflict();
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
    user: User,
    options: {
      ip: string;
      userAgent: string;
      provider: AccountProvider;
      restorationAt: Temporal.Instant;
    },
    onLinkInTransaction?: () => Promise<void>,
  ): Promise<LoginReadModel> {
    const userId = user.id.value;
    // 복구와 발급 사이에 역할이 바뀌었을 수 있어 최신 행의 역할로 토큰을 만든다
    const latest = await this.#dependencies.userRepository.findById(user.id);
    if (latest == null) {
      throw userNotFound(userId);
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

    await Promise.all([
      this.#dependencies.cacheService.invalidateUserProfile(user.id),
      this.#dependencies.entitlementCache.invalidateEntitlements(user.id),
    ]);
    this.#dependencies.logger.log({
      event: UserLogEvent.ACCOUNT_RESTORED,
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
  ): Promise<LoginReadModel> {
    const user = await this.#dependencies.userRepository.findById(UserId.reconstitute(userId));

    if (user == null) {
      throw userNotFound(userId);
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
    existingUser: User,
    provider: AccountProvider,
    providerAccountId: string,
    options: {
      emailVerified?: boolean;
      ip: string;
      userAgent: string;
    },
  ): Promise<LoginReadModel> {
    const restorationAt = this.#dependencies.clock.now();
    const needsRestore = existingUser.requiresRestoration(restorationAt);

    const isTrusted = this.#isTrustedProvider(provider);
    const isEmailVerified = options.emailVerified === true;

    if (isTrusted && isEmailVerified) {
      this.#dependencies.logger.log({
        event: SessionLogEvent.OAUTH_ACCOUNT_AUTO_LINKING,
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
            this.#linkOAuthAccount(existingUser.id, provider, providerAccountId, {
              ip: options.ip,
              userAgent: options.userAgent,
            }),
        );

        return { ...loginResult, accountRestored: true };
      }

      const loginResult = await this.#dependencies.unitOfWork.run(async () => {
        await this.#linkOAuthAccount(existingUser.id, provider, providerAccountId, {
          ip: options.ip,
          userAgent: options.userAgent,
        });

        return this.#createSessionAndTokens(existingUser.id.value, existingUser.email, {
          ip: options.ip,
          userAgent: options.userAgent,
          provider,
        });
      });
      await this.#dependencies.cacheService.invalidateUserProfile(existingUser.id);
      return loginResult;
    }

    this.#dependencies.logger.warn({
      event: SessionLogEvent.OAUTH_ACCOUNT_LINK_REQUIRED,
      userId: existingUser.id.value,
      provider,
    });

    await this.#dependencies.securityLogRepository.create({
      userId: existingUser.id,
      event: SECURITY_EVENT.OAUTH_LINK_REQUIRED,
      ipAddress: options.ip,
      userAgent: options.userAgent,
      metadata: {
        provider,
        reason: isTrusted ? "email_not_verified" : "untrusted_provider",
      },
    });

    throw oauthAccountNotLinked(provider, providerAccountId, existingUser.email);
  }
}
