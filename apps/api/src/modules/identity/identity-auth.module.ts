import { Module } from "@nestjs/common";
import { HttpClient, HttpClientModule, getHttpClientToken } from "@nestjs/http-client";
import { JwtModule, type JwtSignOptions } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import { EngagementCommentsModule } from "#api/modules/engagement/engagement-comments.public";
import { UserSettingsModule } from "#api/modules/identity/identity-settings.public";
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
import { TypedConfigService } from "#api/platform/config/services/config.service";

import {
  AUTH_ACCOUNT_REPOSITORY,
  AUTH_CACHE,
  AUTH_EMAIL_SENDER,
  AUTH_LOGIN_ATTEMPT_REPOSITORY,
  AUTH_OAUTH_STATE_REPOSITORY,
  AUTH_PASSWORD_HASHER,
  AUTH_REGISTRATION_NOTIFIER,
  AUTH_RUNTIME_CONFIG,
  AUTH_SECURITY_LOG_REPOSITORY,
  AUTH_SESSION_REPOSITORY,
  AUTH_TOKEN_ISSUER,
  AUTH_USER_ACTIVITY_WRITER,
  AUTH_USER_REPOSITORY,
  AUTH_VERIFICATION_REPOSITORY,
} from "./application/ports/auth/index.js";
import { OAUTH_IDENTITY_PROVIDER_REGISTRY } from "./application/ports/auth/oauth-identity-provider.port.js";
import { RETENTION_ENROLLER } from "./application/ports/auth/retention-enroller.port.js";
import { USER_PROVISIONING_SEEDER } from "./application/ports/auth/user-provisioning-seeder.port.js";
import { VERIFICATION_CODE_SECURITY } from "./application/ports/auth/verification-code-security.port.js";
import {
  accountNotificationCleanupProvider,
  accountTodoCommentCleanupProvider,
} from "./identity-auth-account-cleanup.providers.js";
import {
  changePasswordProvider,
  completeOAuthAuthorizationProvider,
  deleteAccountProvider,
  exchangeOAuthCodeProvider,
  getCurrentUserProvider,
  getOAuthRedirectUriProvider,
  issueLoginProvider,
  linkOAuthAccountProvider,
  linkOAuthAccountWithCodeProvider,
  listActiveSessionsProvider,
  listLinkedAccountsProvider,
  loginWithOAuthTokenProvider,
  loginWithPasswordProvider,
  logoutAllProvider,
  logoutProvider,
  linkOAuthIdentityProvider,
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
} from "./identity-auth-application.providers.js";
import { AuthCacheAdapter } from "./infrastructure/adapters/auth/auth-cache.adapter.js";
import { NodeVerificationCodeSecurityAdapter } from "./infrastructure/adapters/auth/node-verification-code-security.adapter.js";
import { PasswordService } from "./infrastructure/adapters/auth/password.service.js";
import { RetentionEnrollerAdapter } from "./infrastructure/adapters/auth/retention-enroller.adapter.js";
import { TokenService } from "./infrastructure/adapters/auth/token.service.js";
import { UserProvisioningSeederAdapter } from "./infrastructure/adapters/auth/user-provisioning-seeder.adapter.js";
import { JwtAuthGuard, JwtRefreshGuard } from "./infrastructure/guards/auth/index.js";
import { AccountPurgeJob } from "./infrastructure/jobs/auth/account-purge.job.js";
import { AccountPurgeProcessor } from "./infrastructure/jobs/auth/account-purge.processor.js";
import { createOAuthProviderRegistry } from "./infrastructure/oauth/auth/adapters/index.js";
import { OAuthTokenVerifierService } from "./infrastructure/oauth/auth/verifier/oauth-token-verifier.service.js";
import {
  AccountRepository,
  LoginAttemptRepository,
  OAuthStateRepository,
  SecurityLogRepository,
  SessionRepository,
  UserRepository,
  VerificationRepository,
} from "./infrastructure/persistence/auth/index.js";
import { JwtRefreshStrategy, JwtStrategy } from "./infrastructure/strategies/auth/index.js";
import {
  AccountController,
  AuthController,
  OAuthController,
  SessionController,
} from "./presentation/controllers/auth/index.js";
import { LastActiveInterceptor } from "./presentation/interceptors/auth/last-active.interceptor.js";

/**
 * 인증 모듈
 *
 * 이메일 기반 회원가입/로그인, JWT 토큰 관리, 세션 관리를 담당합니다.
 */
@Module({
  imports: [
    HttpClientModule.register({ name: "oauth", retry: false, throwOnHttpError: false }),
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      inject: [TypedConfigService],
      useFactory: (configService: TypedConfigService) => ({
        secret: configService.get("JWT_SECRET"),
        signOptions: {
          expiresIn: configService.get("JWT_EXPIRES_IN"),
        } as JwtSignOptions,
      }),
    }),
    OperationsNotificationsModule,
    NotificationDeliveryModule,
    NotificationEmailModule,
    // 회원가입 기본값 시딩(설정·동의·기본 카테고리)을 파사드에 위임하기 위한 의존.
    UserSettingsModule,
    PlanningCategoriesModule,
    NotificationRetentionModule,
    EngagementCommentsModule,
  ],
  controllers: [AuthController, OAuthController, SessionController, AccountController],
  providers: [
    // Repositories
    UserRepository,
    AccountRepository,
    SessionRepository,
    VerificationRepository,
    LoginAttemptRepository,
    SecurityLogRepository,
    OAuthStateRepository,
    { provide: AUTH_USER_REPOSITORY, useExisting: UserRepository },
    { provide: AUTH_USER_ACTIVITY_WRITER, useExisting: UserRepository },
    { provide: AUTH_ACCOUNT_REPOSITORY, useExisting: AccountRepository },
    { provide: AUTH_SESSION_REPOSITORY, useExisting: SessionRepository },
    {
      provide: AUTH_VERIFICATION_REPOSITORY,
      useExisting: VerificationRepository,
    },
    {
      provide: AUTH_LOGIN_ATTEMPT_REPOSITORY,
      useExisting: LoginAttemptRepository,
    },
    {
      provide: AUTH_SECURITY_LOG_REPOSITORY,
      useExisting: SecurityLogRepository,
    },
    {
      provide: AUTH_OAUTH_STATE_REPOSITORY,
      useExisting: OAuthStateRepository,
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
    accountNotificationCleanupProvider,
    accountTodoCommentCleanupProvider,
    // Services
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
    updateProfileProvider,
    deleteAccountProvider,
    listLinkedAccountsProvider,
    unlinkOAuthAccountProvider,
    listActiveSessionsProvider,
    revokeSessionProvider,
    getOAuthRedirectUriProvider,
    startOAuthAuthorizationProvider,
    completeOAuthAuthorizationProvider,
    loginWithOAuthTokenProvider,
    linkOAuthAccountProvider,
    linkOAuthAccountWithCodeProvider,
    exchangeOAuthCodeProvider,
    // OAuth 신원 제공자 레지스트리 (provider → 벤더 어댑터 Map)
    {
      provide: OAUTH_IDENTITY_PROVIDER_REGISTRY,
      inject: [TypedConfigService, OAuthTokenVerifierService, getHttpClientToken("oauth")],
      useFactory: (
        configService: TypedConfigService,
        tokenVerifier: OAuthTokenVerifierService,
        http: HttpClient,
      ) => createOAuthProviderRegistry(configService, tokenVerifier, http),
    },
    // Strategies
    JwtStrategy,
    JwtRefreshStrategy,
    // Guards
    JwtAuthGuard,
    JwtRefreshGuard,
    LastActiveInterceptor,
    // Jobs
    AccountPurgeJob,
    AccountPurgeProcessor,
  ],
  exports: [JwtAuthGuard, JwtRefreshGuard, LastActiveInterceptor],
})
export class AuthModule {}
