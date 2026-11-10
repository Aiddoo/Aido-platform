import { Module } from "@nestjs/common";
import { HttpClient, HttpClientModule, getHttpClientToken } from "@nestjs/http-client";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import { AccessModule } from "#api/modules/access/access-entitlement.public";
import { BillingSubscriptionsModule } from "#api/modules/billing/billing-subscriptions.public";
import { EngagementCommentsModule } from "#api/modules/engagement/engagement-comments.public";
import { IdentitySettingsModule } from "#api/modules/identity/identity-settings.public";
import { NotificationDeliveryModule } from "#api/modules/notification/notification-delivery.public";
import {
  NotificationEmailModule,
  TransactionalEmailSender,
} from "#api/modules/notification/notification-email.public";
import { NotificationRetentionModule } from "#api/modules/notification/notification-retention.public";
import {
  AdminEventNotifier,
  OperationsNotificationsModule,
} from "#api/modules/operations/operations-notifications.public";
import { PlanningCategoriesModule } from "#api/modules/planning/planning-categories.public";
import { SocialCheersModule } from "#api/modules/social/social-cheers.public";
import { SocialFriendsModule } from "#api/modules/social/social-friends.public";
import { SocialNudgesModule } from "#api/modules/social/social-nudges.public";
import { TypedConfigService } from "#api/platform/config/services/config.service";
import { OutboundPolicyRegistry } from "#api/platform/resilience/outbound-policy.registry";

import { JwtRefreshStrategy, JwtStrategy } from "../infrastructure/strategies/auth/index.js";
import { LastActiveInterceptor } from "../presentation/interceptors/auth/last-active.interceptor.js";
import {
  AUTH_CACHE,
  AUTH_EMAIL_SENDER,
  AUTH_REGISTRATION_NOTIFIER,
  AUTH_RUNTIME_CONFIG,
  AUTH_USER_ACTIVITY_WRITER,
} from "./application/ports/auth-collaboration.port.js";
import { AUTH_PASSWORD_HASHER, AUTH_TOKEN_ISSUER } from "./application/ports/auth-crypto.port.js";
import {
  AUTH_ACCOUNT_REPOSITORY,
  AUTH_LOGIN_ATTEMPT_REPOSITORY,
  AUTH_OAUTH_STATE_REPOSITORY,
  AUTH_SECURITY_LOG_REPOSITORY,
  AUTH_SESSION_REPOSITORY,
  AUTH_USER_REPOSITORY,
  AUTH_VERIFICATION_REPOSITORY,
} from "./application/ports/auth-persistence.port.js";
import { OAUTH_IDENTITY_PROVIDER_REGISTRY } from "./application/ports/oauth-identity-provider.port.js";
import { RETENTION_ENROLLER } from "./application/ports/retention-enroller.port.js";
import { SESSION_PUSH_DEVICE_RELEASER } from "./application/ports/session-push-device-releaser.port.js";
import { USER_PROVISIONING_SEEDER } from "./application/ports/user-provisioning-seeder.port.js";
import { VERIFICATION_CODE_SECURITY } from "./application/ports/verification-code-security.port.js";
import {
  accountNotificationCleanupProvider,
  accountTodoCommentCleanupProvider,
  accountUsageCleanupProvider,
} from "./identity-auth-account-cleanup.providers.js";
import {
  changePasswordProvider,
  completeOAuthAuthorizationProvider,
  deleteAccountProvider,
  exchangeOAuthCodeProvider,
  getCurrentUserProvider,
  getEntitlementSnapshotProvider,
  getOAuthRedirectUriProvider,
  issueLoginProvider,
  linkOAuthAccountProvider,
  linkOAuthAccountWithCodeProvider,
  listActiveSessionsProvider,
  listLinkedAccountsProvider,
  loginWithMobileOAuthTokenProvider,
  loginWithOAuthTokenProvider,
  loginWithPasswordProvider,
  logoutAllProvider,
  logoutProvider,
  linkOAuthIdentityProvider,
  oauthSignupNotifierProvider,
  provisionUserProvider,
  purgeDeletedAccountsProvider,
  restoreAccountProvider,
  refreshTokensProvider,
  registerProvider,
  requestPasswordResetProvider,
  requestPasswordSetupCodeProvider,
  resendVerificationProvider,
  resetPasswordProvider,
  revokeSessionProvider,
  sessionServiceProvider,
  setPasswordProvider,
  startOAuthAuthorizationProvider,
  unlinkOAuthAccountProvider,
  updateProfileProvider,
  verificationServiceProvider,
  verifyEmailProvider,
} from "./identity-auth.providers.js";
import { PasswordService } from "./infrastructure/adapters/argon2-password-hasher.adapter.js";
import { AuthCacheAdapter } from "./infrastructure/adapters/auth-cache.adapter.js";
import { TokenService } from "./infrastructure/adapters/jwt-token-issuer.adapter.js";
import { NodeVerificationCodeSecurityAdapter } from "./infrastructure/adapters/node-verification-code-security.adapter.js";
import { createOAuthProviderRegistry } from "./infrastructure/adapters/oauth-identity-provider-registry.adapter.js";
import {
  OAUTH_PROVIDER_TIMEOUT_MS,
  OAuthTokenVerifierService,
} from "./infrastructure/adapters/oauth-token-verifier.adapter.js";
import { RetentionEnrollerAdapter } from "./infrastructure/adapters/retention-enroller.adapter.js";
import { SessionPushDeviceReleaserAdapter } from "./infrastructure/adapters/session-push-device-releaser.adapter.js";
import { UserProvisioningSeederAdapter } from "./infrastructure/adapters/user-provisioning-seeder.adapter.js";
import { AccountPurgeProcessor } from "./infrastructure/jobs/account-purge.processor.js";
import { AccountPurgeJob } from "./infrastructure/jobs/account-purge.scheduler.js";
import { DrizzleAccountRepository } from "./infrastructure/persistence/drizzle-account.repository.js";
import { DrizzleLoginAttemptRepository } from "./infrastructure/persistence/drizzle-login-attempt.repository.js";
import { DrizzleOAuthStateRepository } from "./infrastructure/persistence/drizzle-oauth-state.repository.js";
import { DrizzleSecurityLogRepository } from "./infrastructure/persistence/drizzle-security-log.repository.js";
import { DrizzleSessionRepository } from "./infrastructure/persistence/drizzle-session.repository.js";
import { DrizzleUserRepository } from "./infrastructure/persistence/drizzle-user.repository.js";
import { DrizzleVerificationRepository } from "./infrastructure/persistence/drizzle-verification.repository.js";
import { JwtAuthGuard } from "./presentation/http/guards/jwt-auth.guard.js";
import { JwtRefreshGuard } from "./presentation/http/guards/jwt-refresh.guard.js";
import { AccountController } from "./presentation/http/v1/account.controller.js";
import { AuthController } from "./presentation/http/v1/auth.controller.js";
import { EntitlementController } from "./presentation/http/v1/entitlement.controller.js";
import { OAuthController } from "./presentation/http/v1/oauth.controller.js";
import { SessionController } from "./presentation/http/v1/session.controller.js";

/**
 * 인증 모듈
 *
 * 이메일 기반 회원가입/로그인, JWT 토큰 관리, 세션 관리를 담당합니다.
 */
@Module({
  imports: [
    HttpClientModule.register({
      name: "oauth",
      retry: false,
      throwOnHttpError: false,
      timeout: OAUTH_PROVIDER_TIMEOUT_MS,
    }),
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      inject: [TypedConfigService],
      useFactory: (configService: TypedConfigService) => ({
        secret: configService.jwtSecret,
      }),
    }),
    OperationsNotificationsModule,
    NotificationDeliveryModule,
    NotificationEmailModule,
    // 회원가입 기본값 시딩(설정·동의·기본 카테고리)을 파사드에 위임하기 위한 의존.
    IdentitySettingsModule,
    PlanningCategoriesModule,
    NotificationRetentionModule,
    EngagementCommentsModule,
    BillingSubscriptionsModule,
    AccessModule,
    SocialCheersModule,
    SocialFriendsModule,
    SocialNudgesModule,
  ],
  controllers: [
    AuthController,
    OAuthController,
    SessionController,
    AccountController,
    EntitlementController,
  ],
  providers: [
    DrizzleUserRepository,
    DrizzleAccountRepository,
    DrizzleSessionRepository,
    DrizzleVerificationRepository,
    DrizzleLoginAttemptRepository,
    DrizzleSecurityLogRepository,
    DrizzleOAuthStateRepository,
    { provide: AUTH_USER_REPOSITORY, useExisting: DrizzleUserRepository },
    { provide: AUTH_USER_ACTIVITY_WRITER, useExisting: DrizzleUserRepository },
    { provide: AUTH_ACCOUNT_REPOSITORY, useExisting: DrizzleAccountRepository },
    { provide: AUTH_SESSION_REPOSITORY, useExisting: DrizzleSessionRepository },
    {
      provide: AUTH_VERIFICATION_REPOSITORY,
      useExisting: DrizzleVerificationRepository,
    },
    {
      provide: AUTH_LOGIN_ATTEMPT_REPOSITORY,
      useExisting: DrizzleLoginAttemptRepository,
    },
    {
      provide: AUTH_SECURITY_LOG_REPOSITORY,
      useExisting: DrizzleSecurityLogRepository,
    },
    {
      provide: AUTH_OAUTH_STATE_REPOSITORY,
      useExisting: DrizzleOAuthStateRepository,
    },
    // 프로비저닝 시딩 어댑터 (user-settings·todo-category 파사드 위임)
    {
      provide: USER_PROVISIONING_SEEDER,
      useClass: UserProvisioningSeederAdapter,
    },
    {
      provide: RETENTION_ENROLLER,
      useClass: RetentionEnrollerAdapter,
    },
    {
      provide: SESSION_PUSH_DEVICE_RELEASER,
      useClass: SessionPushDeviceReleaserAdapter,
    },
    accountNotificationCleanupProvider,
    accountTodoCommentCleanupProvider,
    accountUsageCleanupProvider,
    PasswordService,
    sessionServiceProvider,
    TokenService,
    { provide: AUTH_PASSWORD_HASHER, useExisting: PasswordService },
    { provide: AUTH_TOKEN_ISSUER, useExisting: TokenService },
    AuthCacheAdapter,
    { provide: AUTH_CACHE, useExisting: AuthCacheAdapter },
    { provide: AUTH_EMAIL_SENDER, useExisting: TransactionalEmailSender },
    {
      provide: AUTH_REGISTRATION_NOTIFIER,
      useExisting: AdminEventNotifier,
    },
    { provide: AUTH_RUNTIME_CONFIG, useExisting: TypedConfigService },
    verificationServiceProvider,
    {
      provide: VERIFICATION_CODE_SECURITY,
      useClass: NodeVerificationCodeSecurityAdapter,
    },
    OAuthTokenVerifierService,
    linkOAuthIdentityProvider,
    oauthSignupNotifierProvider,
    // Use-cases (이메일·소셜 로그인·프로비저닝 수렴)
    issueLoginProvider,
    restoreAccountProvider,
    purgeDeletedAccountsProvider,
    provisionUserProvider,
    registerProvider,
    verifyEmailProvider,
    resendVerificationProvider,
    loginWithPasswordProvider,
    logoutProvider,
    logoutAllProvider,
    refreshTokensProvider,
    requestPasswordResetProvider,
    resetPasswordProvider,
    requestPasswordSetupCodeProvider,
    setPasswordProvider,
    changePasswordProvider,
    getCurrentUserProvider,
    getEntitlementSnapshotProvider,
    updateProfileProvider,
    deleteAccountProvider,
    listLinkedAccountsProvider,
    unlinkOAuthAccountProvider,
    listActiveSessionsProvider,
    revokeSessionProvider,
    getOAuthRedirectUriProvider,
    startOAuthAuthorizationProvider,
    completeOAuthAuthorizationProvider,
    loginWithMobileOAuthTokenProvider,
    loginWithOAuthTokenProvider,
    linkOAuthAccountProvider,
    linkOAuthAccountWithCodeProvider,
    exchangeOAuthCodeProvider,
    // OAuth 신원 제공자 레지스트리 (provider → 벤더 어댑터 Map)
    {
      provide: OAUTH_IDENTITY_PROVIDER_REGISTRY,
      inject: [
        TypedConfigService,
        OAuthTokenVerifierService,
        getHttpClientToken("oauth"),
        OutboundPolicyRegistry,
      ],
      useFactory: (
        configService: TypedConfigService,
        tokenVerifier: OAuthTokenVerifierService,
        http: HttpClient,
        policies: OutboundPolicyRegistry,
      ) => createOAuthProviderRegistry(configService, tokenVerifier, http, policies),
    },
    JwtStrategy,
    JwtRefreshStrategy,
    JwtAuthGuard,
    JwtRefreshGuard,
    LastActiveInterceptor,
    AccountPurgeJob,
    AccountPurgeProcessor,
  ],
  exports: [JwtAuthGuard, JwtRefreshGuard, LastActiveInterceptor],
})
export class IdentityAuthModule {}
