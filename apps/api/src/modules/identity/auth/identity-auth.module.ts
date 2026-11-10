import { Module } from "@nestjs/common";
import { ConfigModule, type ConfigType } from "@nestjs/config";
import { HttpClientModule } from "@nestjs/http-client";
import { JwtModule } from "@nestjs/jwt";

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
import { jwtConfig } from "#api/platform/config/jwt.config";
import { TypedConfigService } from "#api/platform/config/services/config.service";

import { LastActiveInterceptor } from "../presentation/interceptors/auth/last-active.interceptor.js";
import {
  AuthCachePort,
  AuthEmailSenderPort,
  AuthRegistrationNotifierPort,
  AuthRuntimeConfigPort,
  AuthUserActivityWriterPort,
} from "./application/ports/auth-collaboration.port.js";
import {
  AuthPasswordHasherPort,
  AuthTokenIssuerPort,
} from "./application/ports/auth-crypto.port.js";
import {
  AuthAccountRepositoryPort,
  AuthLoginAttemptRepositoryPort,
  AuthOAuthStateRepositoryPort,
  AuthSecurityLogRepositoryPort,
  AuthSessionRepositoryPort,
  AuthUserRepositoryPort,
  AuthVerificationRepositoryPort,
} from "./application/ports/auth-persistence.port.js";
import { OAuthIdentityProviderRegistryPort } from "./application/ports/oauth-identity-provider.port.js";
import { RetentionEnrollerPort } from "./application/ports/retention-enroller.port.js";
import { SessionPushDeviceReleaserPort } from "./application/ports/session-push-device-releaser.port.js";
import { UserProvisioningSeederPort } from "./application/ports/user-provisioning-seeder.port.js";
import { VerificationCodeSecurityPort } from "./application/ports/verification-code-security.port.js";
import {
  accountNotificationCleanupProvider,
  accountTodoCommentCleanupProvider,
  accountUsageCleanupProvider,
} from "./identity-auth-account-cleanup.providers.js";
import { identityAuthConfig } from "./identity-auth.config.js";
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
  authenticateSessionProvider,
  createSessionProvider,
  setPasswordProvider,
  startOAuthAuthorizationProvider,
  unlinkOAuthAccountProvider,
  updateProfileProvider,
  verificationServiceProvider,
  verifyEmailProvider,
} from "./identity-auth.providers.js";
import { AppleOAuthIdentityAdapter } from "./infrastructure/adapters/apple-oauth-identity.adapter.js";
import { Argon2PasswordHasherAdapter } from "./infrastructure/adapters/argon2-password-hasher.adapter.js";
import { AuthCacheAdapter } from "./infrastructure/adapters/auth-cache.adapter.js";
import { GoogleOAuthIdentityAdapter } from "./infrastructure/adapters/google-oauth-identity.adapter.js";
import { JwtTokenIssuerAdapter } from "./infrastructure/adapters/jwt-token-issuer.adapter.js";
import { KakaoOAuthIdentityAdapter } from "./infrastructure/adapters/kakao-oauth-identity.adapter.js";
import { NaverOAuthIdentityAdapter } from "./infrastructure/adapters/naver-oauth-identity.adapter.js";
import { NodeVerificationCodeSecurityAdapter } from "./infrastructure/adapters/node-verification-code-security.adapter.js";
import { OAuthIdentityProviderRegistryAdapter } from "./infrastructure/adapters/oauth-identity-provider-registry.adapter.js";
import { OAUTH_PROVIDER_TIMEOUT_MS } from "./infrastructure/adapters/oauth-outbound.policy.js";
import { RetentionEnrollerAdapter } from "./infrastructure/adapters/retention-enroller.adapter.js";
import { SessionPushDeviceReleaserAdapter } from "./infrastructure/adapters/session-push-device-releaser.adapter.js";
import { UserProvisioningSeederAdapter } from "./infrastructure/adapters/user-provisioning-seeder.adapter.js";
import { AccountPurgeProcessor } from "./infrastructure/jobs/account-purge.processor.js";
import { AccountPurgeScheduler } from "./infrastructure/jobs/account-purge.scheduler.js";
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
    ConfigModule.forFeature(identityAuthConfig),
    HttpClientModule.register({
      name: "oauth",
      retry: false,
      throwOnHttpError: false,
      timeout: OAUTH_PROVIDER_TIMEOUT_MS,
    }),
    JwtModule.registerAsync({
      inject: [jwtConfig.KEY],
      useFactory: (jwt: ConfigType<typeof jwtConfig>) => ({ secret: jwt.secret }),
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
    { provide: AuthUserRepositoryPort, useExisting: DrizzleUserRepository },
    { provide: AuthUserActivityWriterPort, useExisting: DrizzleUserRepository },
    { provide: AuthAccountRepositoryPort, useExisting: DrizzleAccountRepository },
    { provide: AuthSessionRepositoryPort, useExisting: DrizzleSessionRepository },
    {
      provide: AuthVerificationRepositoryPort,
      useExisting: DrizzleVerificationRepository,
    },
    {
      provide: AuthLoginAttemptRepositoryPort,
      useExisting: DrizzleLoginAttemptRepository,
    },
    {
      provide: AuthSecurityLogRepositoryPort,
      useExisting: DrizzleSecurityLogRepository,
    },
    {
      provide: AuthOAuthStateRepositoryPort,
      useExisting: DrizzleOAuthStateRepository,
    },
    // 프로비저닝 시딩 어댑터 (user-settings·todo-category 파사드 위임)
    {
      provide: UserProvisioningSeederPort,
      useClass: UserProvisioningSeederAdapter,
    },
    {
      provide: RetentionEnrollerPort,
      useClass: RetentionEnrollerAdapter,
    },
    {
      provide: SessionPushDeviceReleaserPort,
      useClass: SessionPushDeviceReleaserAdapter,
    },
    accountNotificationCleanupProvider,
    accountTodoCommentCleanupProvider,
    accountUsageCleanupProvider,
    Argon2PasswordHasherAdapter,
    createSessionProvider,
    JwtTokenIssuerAdapter,
    { provide: AuthPasswordHasherPort, useExisting: Argon2PasswordHasherAdapter },
    { provide: AuthTokenIssuerPort, useExisting: JwtTokenIssuerAdapter },
    AuthCacheAdapter,
    { provide: AuthCachePort, useExisting: AuthCacheAdapter },
    { provide: AuthEmailSenderPort, useExisting: TransactionalEmailSender },
    {
      provide: AuthRegistrationNotifierPort,
      useExisting: AdminEventNotifier,
    },
    { provide: AuthRuntimeConfigPort, useExisting: TypedConfigService },
    verificationServiceProvider,
    {
      provide: VerificationCodeSecurityPort,
      useClass: NodeVerificationCodeSecurityAdapter,
    },
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
    AppleOAuthIdentityAdapter,
    GoogleOAuthIdentityAdapter,
    KakaoOAuthIdentityAdapter,
    NaverOAuthIdentityAdapter,
    { provide: OAuthIdentityProviderRegistryPort, useClass: OAuthIdentityProviderRegistryAdapter },
    authenticateSessionProvider,
    JwtAuthGuard,
    JwtRefreshGuard,
    LastActiveInterceptor,
    AccountPurgeScheduler,
    AccountPurgeProcessor,
  ],
  exports: [JwtAuthGuard, JwtRefreshGuard, LastActiveInterceptor],
})
export class IdentityAuthModule {}
