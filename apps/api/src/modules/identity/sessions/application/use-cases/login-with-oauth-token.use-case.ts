import { type OAUTH_PROVIDERS, resolveSupportedLocale } from "@aido/api/vocabulary";

import type { EntitlementCacheInvalidatorPort } from "#api/modules/access/feature-grants/access-feature-grants.public";
import {
  TRUSTED_EMAIL_PROVIDERS,
  type AccountProvider,
} from "#api/modules/identity/linked-accounts/domain/linked-accounts.constants";
import { oauthAccountAlreadyLinked } from "#api/modules/identity/linked-accounts/domain/linked-accounts.errors";
import type { ProviderAccountId } from "#api/modules/identity/linked-accounts/domain/provider-account-id.vo";
import { LOGIN_FAILURE_REASON } from "#api/modules/identity/sessions/domain/sessions.constants";
import { IdentityPersistenceConflict } from "#api/modules/identity/shared/domain/identity.errors";
import { REQUEST_ORIGIN_DEFAULTS } from "#api/modules/identity/shared/domain/request-metadata.constants";
import { emailAlreadyRegistered } from "#api/modules/identity/users/application/users.errors";
import { assertStatusAllowsLogin } from "#api/modules/identity/users/domain/account-status.domain-service";
import type { User } from "#api/modules/identity/users/domain/user.aggregate";
import { SECURITY_EVENT } from "#api/modules/identity/users/domain/users.constants";
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
import type { UserProfileInvalidatorPort } from "../../../users/application/ports/user-profile-invalidator.port.js";
import type { UserRepositoryPort } from "../../../users/application/ports/user.repository.port.js";
import type { RestoreAccountUseCase } from "../../../users/application/use-cases/restore-account.use-case.js";
import { userNotFound } from "../../../users/application/users.errors.js";
import { UserLogEvent } from "../../../users/application/users.log-events.js";
import type { LoginAttemptRepositoryPort } from "../ports/login-attempt.repository.port.js";
import type { LoginReadModel, SocialLoginReadModel } from "../read-models/login.read-model.js";
import { oauthAccountNotLinked } from "../sessions.errors.js";
import { SessionLogEvent } from "../sessions.log-events.js";
import type { AutoLinkOAuthAccountUseCase } from "./auto-link-oauth-account.use-case.js";
import type { IssueLoginUseCase } from "./issue-login.use-case.js";
import type { RegisterSocialUserUseCase } from "./register-social-user.use-case.js";

export interface LoginWithOAuthTokenCommand {
  readonly provider: (typeof OAUTH_PROVIDERS)[number];
  readonly token: string;
  readonly userName?: string;
  readonly metadata?: RequestMetadata;
  readonly nonce?: string;
}

interface LoginWithOAuthTokenDependencies {
  readonly registry: Pick<OAuthIdentityProviderRegistryPort, "find">;
  readonly userRepository: Pick<UserRepositoryPort, "findById" | "findByEmail">;
  readonly accountRepository: Pick<LinkedAccountsRepositoryPort, "findUserIdByProviderAccountId">;
  readonly securityLogRepository: Pick<SecurityLogRepositoryPort, "create">;
  readonly loginAttemptRepository: Pick<LoginAttemptRepositoryPort, "create">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly cacheService: Pick<UserProfileInvalidatorPort, "invalidateUserProfile">;
  // 탈퇴 유예 중에는 권한을 무료로 캐시하므로 되살리면 함께 비운다
  readonly entitlementCache: Pick<EntitlementCacheInvalidatorPort, "invalidateEntitlements">;
  readonly issueLoginUseCase: Pick<IssueLoginUseCase, "execute">;
  readonly registerSocialUser: Pick<RegisterSocialUserUseCase, "execute">;
  readonly autoLinkOAuthAccount: Pick<AutoLinkOAuthAccountUseCase, "execute">;
  readonly restoreAccount: Pick<RestoreAccountUseCase, "execute">;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

interface SocialLoginRequest {
  readonly ip: string;
  readonly userAgent: string;
  readonly provider: AccountProvider;
}

// 공급자가 확인한 계정과 그 계정으로 만들 사용자의 값
interface SocialIdentity {
  readonly providerAccountId: ProviderAccountId;
  readonly email: string | undefined;
  readonly options: SocialLoginOptions;
  readonly metadata?: RequestMetadata;
}

export class LoginWithOAuthTokenUseCase {
  readonly #dependencies: LoginWithOAuthTokenDependencies;

  constructor(dependencies: LoginWithOAuthTokenDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: LoginWithOAuthTokenCommand): Promise<SocialLoginReadModel> {
    const strategy = this.#dependencies.registry.find(input.provider);
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
    return this.#handleSocialLogin(
      {
        providerAccountId: profile.id,
        email: profile.email ?? undefined,
        options,
        metadata: input.metadata,
      },
      {
        ip: input.metadata?.ip ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_IP,
        userAgent: input.metadata?.userAgent ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_USER_AGENT,
        provider: input.provider,
      },
    );
  }

  async #handleSocialLogin(
    identity: SocialIdentity,
    request: SocialLoginRequest,
  ): Promise<SocialLoginReadModel> {
    const { accountRepository, userRepository } = this.#dependencies;
    const { provider } = request;
    const { providerAccountId, email } = identity;

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
          const loginResult = await this.#handleEmailConflict(existingUser, identity, request);
          return { ...loginResult, isNewUser: false };
        } catch (error) {
          const linkedMeanwhile = await this.#findUserLinkedMeanwhile(error, identity, request);
          // 이 사용자에게 같은 공급자의 다른 계정이 있거나 다른 사용자에게 연결됐으면 진짜 충돌이다
          if (linkedMeanwhile == null || !linkedMeanwhile.equals(existingUser.id)) {
            throw oauthAccountAlreadyLinked(provider, providerAccountId.value);
          }
          return this.#loginLinkedUser(existingUser.id.value, request);
        }
      }
    }
    return this.#registerAndLogin(identity, request);
  }

  async #registerAndLogin(
    identity: SocialIdentity,
    request: SocialLoginRequest,
  ): Promise<SocialLoginReadModel> {
    const { provider } = request;
    const effectiveEmail =
      identity.email ??
      `${provider.toLowerCase()}_${identity.providerAccountId.value}@social.aido.kr`;
    let newUser: { id: string };
    try {
      newUser = await this.#dependencies.registerSocialUser.execute({
        email: effectiveEmail,
        provider,
        providerAccountId: identity.providerAccountId,
        userName: identity.options.userName,
        profileImage: identity.options.profileImage,
        // 언어를 보내지 않은 가입 요청은 옛 앱이라 한국어 카테고리로 시작한다
        locale: resolveSupportedLocale(identity.metadata?.locale),
      });
    } catch (error) {
      const linkedMeanwhile = await this.#findUserLinkedMeanwhile(error, identity, request);
      if (linkedMeanwhile == null) {
        // 그사이 다른 가입이 이메일을 가져갔다. 1.15.0이 User_email_key 제약에 주던 응답이다
        throw emailAlreadyRegistered(effectiveEmail);
      }
      return this.#loginLinkedUser(linkedMeanwhile.value, request);
    }
    this.#dependencies.logger.log({
      event: UserLogEvent.USER_REGISTERED,
      userId: newUser.id,
      provider,
    });

    const loginResult = await this.#createSessionAndTokens(newUser.id, effectiveEmail, request);
    return { ...loginResult, isNewUser: true };
  }

  async #loginLinkedUser(
    userId: string,
    request: SocialLoginRequest,
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

    assertStatusAllowsLogin(user.status, "Social login user");
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
    identity: SocialIdentity,
    request: SocialLoginRequest,
  ): Promise<UserId | null> {
    if (!(error instanceof IdentityPersistenceConflict)) {
      throw error;
    }
    return this.#dependencies.accountRepository.findUserIdByProviderAccountId(
      request.provider,
      identity.providerAccountId,
    );
  }

  async #restoreAndCreateSession(
    user: User,
    options: SocialLoginRequest & { readonly restorationAt: Temporal.Instant },
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
      return { userId, ...outcome };
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
    request: SocialLoginRequest,
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
        provider: request.provider,
        ip: request.ip,
        userAgent: request.userAgent,
        deviceFingerprint: request.userAgent,
        securityMetadata: { provider: request.provider },
      });
      return { userId, ...outcome };
    });
  }

  async #handleEmailConflict(
    existingUser: User,
    identity: SocialIdentity,
    request: SocialLoginRequest,
  ): Promise<LoginReadModel> {
    const { provider } = request;
    const restorationAt = this.#dependencies.clock.now();
    const needsRestore = existingUser.requiresRestoration(restorationAt);
    const isTrusted = TRUSTED_EMAIL_PROVIDERS.includes(provider);
    if (isTrusted && identity.options.emailVerified === true) {
      return this.#autoLinkAndLogin(existingUser, identity, {
        ...request,
        restorationAt,
        needsRestore,
      });
    }

    this.#dependencies.logger.warn({
      event: SessionLogEvent.OAUTH_ACCOUNT_LINK_REQUIRED,
      userId: existingUser.id.value,
      provider,
    });

    await this.#dependencies.securityLogRepository.create({
      userId: existingUser.id,
      event: SECURITY_EVENT.OAUTH_LINK_REQUIRED,
      ipAddress: request.ip,
      userAgent: request.userAgent,
      metadata: {
        provider,
        reason: isTrusted ? "email_not_verified" : "untrusted_provider",
      },
    });

    throw oauthAccountNotLinked(provider, identity.providerAccountId.value, existingUser.email);
  }

  async #autoLinkAndLogin(
    existingUser: User,
    identity: SocialIdentity,
    request: SocialLoginRequest & {
      readonly restorationAt: Temporal.Instant;
      readonly needsRestore: boolean;
    },
  ): Promise<LoginReadModel> {
    this.#dependencies.logger.log({
      event: SessionLogEvent.OAUTH_ACCOUNT_AUTO_LINKING,
      userId: existingUser.id.value,
      provider: request.provider,
    });
    const link = () =>
      this.#dependencies.autoLinkOAuthAccount.execute({
        userId: existingUser.id,
        provider: request.provider,
        providerAccountId: identity.providerAccountId,
        ip: request.ip,
        userAgent: request.userAgent,
      });

    if (request.needsRestore) {
      const loginResult = await this.#restoreAndCreateSession(existingUser, request, link);
      return { ...loginResult, accountRestored: true };
    }

    assertStatusAllowsLogin(existingUser.status, "Social login user");
    const loginResult = await this.#dependencies.unitOfWork.run(async () => {
      await link();
      return this.#createSessionAndTokens(existingUser.id.value, existingUser.email, request);
    });
    await this.#dependencies.cacheService.invalidateUserProfile(existingUser.id);
    return loginResult;
  }
}
