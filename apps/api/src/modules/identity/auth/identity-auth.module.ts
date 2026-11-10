import { Module } from "@nestjs/common";
import { ConfigModule, type ConfigType } from "@nestjs/config";
import { HttpClientModule } from "@nestjs/http-client";
import { JwtModule } from "@nestjs/jwt";

import { AccessEntitlementsModule } from "#api/modules/access/entitlements/access-entitlements.public";
import { NotificationPushModule } from "#api/modules/notification/notification-delivery.public";
import {
  NotificationEmailModule,
  TransactionalEmailSender,
} from "#api/modules/notification/notification-email.public";
import { NotificationRetentionModule } from "#api/modules/notification/notification-retention.public";
import {
  AdminEventNotifierPort,
  OperationsAdminNoticesModule,
} from "#api/modules/operations/admin-notices/operations-admin-notices.public";
import { PlanningCategoriesModule } from "#api/modules/planning/categories/planning-categories.public";
import { appConfig, type AppSettings } from "#api/platform/config/app.config";
import { jwtConfig } from "#api/platform/config/jwt.config";

import { IdentityPreferencesModule } from "../preferences/identity-preferences.module.js";
import { IdentityUserAccessModule } from "../users/identity-user-access.module.js";
import { DrizzleUserRepository } from "../users/infrastructure/persistence/drizzle-user.repository.js";
import { AuthAccountRepositoryPort } from "./application/ports/auth-account.repository.port.js";
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
import { AuthLoginAttemptRepositoryPort } from "./application/ports/auth-login-attempt.repository.port.js";
import { AuthOAuthStateRepositoryPort } from "./application/ports/auth-oauth-state.repository.port.js";
import { AuthSecurityLogRepositoryPort } from "./application/ports/auth-security-log.repository.port.js";
import { AuthSessionRepositoryPort } from "./application/ports/auth-session.repository.port.js";
import { AuthUserRepositoryPort } from "./application/ports/auth-user.repository.port.js";
import { AuthVerificationRepositoryPort } from "./application/ports/auth-verification.repository.port.js";
import { OAuthIdentityProviderRegistryPort } from "./application/ports/oauth-identity-provider.port.js";
import { RetentionEnrollerPort } from "./application/ports/retention-enroller.port.js";
import { SessionPushDeviceReleaserPort } from "./application/ports/session-push-device-releaser.port.js";
import { UserProvisioningSeederPort } from "./application/ports/user-provisioning-seeder.port.js";
import { VerificationCodeSecurityPort } from "./application/ports/verification-code-security.port.js";
import { identityAuthConfig } from "./identity-auth.config.js";
import {
  changePasswordProvider,
  completeOAuthAuthorizationProvider,
  exchangeOAuthCodeProvider,
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
  issueVerificationCodeProvider,
  sendVerificationCodeProvider,
  consumeVerificationCodeProvider,
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
import { DrizzleAccountRepository } from "./infrastructure/persistence/drizzle-account.repository.js";
import { DrizzleLoginAttemptRepository } from "./infrastructure/persistence/drizzle-login-attempt.repository.js";
import { DrizzleOAuthStateRepository } from "./infrastructure/persistence/drizzle-oauth-state.repository.js";
import { DrizzleSecurityLogRepository } from "./infrastructure/persistence/drizzle-security-log.repository.js";
import { DrizzleSessionRepository } from "./infrastructure/persistence/drizzle-session.repository.js";
import { DrizzleVerificationRepository } from "./infrastructure/persistence/drizzle-verification.repository.js";
import { JwtAuthGuard } from "./presentation/http/guards/jwt-auth.guard.js";
import { JwtRefreshGuard } from "./presentation/http/guards/jwt-refresh.guard.js";
import { AccountController } from "./presentation/http/v1/account.controller.js";
import { AuthController } from "./presentation/http/v1/auth.controller.js";
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
    AccessEntitlementsModule,
    OperationsAdminNoticesModule,
    NotificationPushModule,
    NotificationEmailModule,
    // 회원가입 기본값 시딩(설정·동의·기본 카테고리)을 파사드에 위임하기 위한 의존.
    IdentityPreferencesModule,
    IdentityUserAccessModule,
    PlanningCategoriesModule,
    NotificationRetentionModule,
  ],
  controllers: [AuthController, OAuthController, SessionController, AccountController],
  providers: [
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
    Argon2PasswordHasherAdapter,
    createSessionProvider,
    JwtTokenIssuerAdapter,
    { provide: AuthPasswordHasherPort, useExisting: Argon2PasswordHasherAdapter },
    { provide: AuthTokenIssuerPort, useExisting: JwtTokenIssuerAdapter },
    { provide: AuthCachePort, useExisting: AuthCacheAdapter },
    { provide: AuthEmailSenderPort, useExisting: TransactionalEmailSender },
    {
      provide: AuthRegistrationNotifierPort,
      useExisting: AdminEventNotifierPort,
    },
    {
      provide: AuthRuntimeConfigPort,
      inject: [appConfig.KEY],
      useFactory: (app: AppSettings): AuthRuntimeConfigPort => ({
        allowsDevRedirects: app.devTools.oauthDevRedirects,
      }),
    },
    issueVerificationCodeProvider,
    sendVerificationCodeProvider,
    consumeVerificationCodeProvider,
    {
      provide: VerificationCodeSecurityPort,
      useClass: NodeVerificationCodeSecurityAdapter,
    },
    linkOAuthIdentityProvider,
    oauthSignupNotifierProvider,
    // Use-cases (이메일·소셜 로그인·프로비저닝 수렴)
    issueLoginProvider,
    restoreAccountProvider,
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
  ],
  // 사용자 slice(IdentityUsersModule)가 탈퇴·프로필 UseCase에 쓴다. auth는 users 모듈을 import하지 않는다
  exports: [
    JwtAuthGuard,
    JwtRefreshGuard,
    AuthUserRepositoryPort,
    AuthUserActivityWriterPort,
    AuthAccountRepositoryPort,
    AuthSessionRepositoryPort,
    AuthSecurityLogRepositoryPort,
    AuthPasswordHasherPort,
    AuthCachePort,
    SessionPushDeviceReleaserPort,
  ],
})
export class IdentityAuthModule {}
