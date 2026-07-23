import { Module } from "@nestjs/common";
import { JwtModule, type JwtSignOptions } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import {
	AdminNotificationFacade,
	AdminNotificationModule,
} from "@/admin-notification";
import { EmailFacade, EmailModule } from "@/email";
import { RetentionModule } from "@/retention";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";
import { TodoCategoryModule } from "@/todo-category";
import { UserSettingsModule } from "@/user-settings";
import {
	AccountFacade,
	AuthFacade,
	OAuthFacade,
	SessionFacade,
} from "./application/facades";
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
} from "./application/ports";
import { OAUTH_IDENTITY_PROVIDER_REGISTRY } from "./application/ports/oauth-identity-provider.port";
import { RETENTION_ENROLLER } from "./application/ports/retention-enroller.port";
import { USER_PROVISIONING_SEEDER } from "./application/ports/user-provisioning-seeder.port";
import {
	GetCurrentUserQuery,
	GetOAuthRedirectUriQuery,
	ListActiveSessionsQuery,
	ListLinkedAccountsQuery,
} from "./application/queries";
import { SessionService, VerificationService } from "./application/services";
import {
	ChangePasswordUseCase,
	CompleteOAuthAuthorizationUseCase,
	DeleteAccountUseCase,
	ExchangeOAuthCodeUseCase,
	LinkOAuthAccountUseCase,
	LinkOAuthAccountWithCodeUseCase,
	LoginWithOAuthTokenUseCase,
	LoginWithPasswordUseCase,
	LogoutAllUseCase,
	LogoutUseCase,
	RefreshTokensUseCase,
	RegisterUseCase,
	RequestPasswordResetUseCase,
	RequestPasswordSetupCodeUseCase,
	ResendVerificationUseCase,
	ResetPasswordUseCase,
	RevokeSessionUseCase,
	SetPasswordUseCase,
	StartOAuthAuthorizationUseCase,
	UnlinkOAuthAccountUseCase,
	UpdateProfileUseCase,
	VerifyEmailUseCase,
} from "./application/use-cases";
import { IssueLoginUseCase } from "./application/use-cases/issue-login/issue-login.use-case";
import { ProvisionUserUseCase } from "./application/use-cases/provision-user/provision-user.use-case";
import {
	CredentialAuthWorkflow,
	OAuthWorkflow,
	PasswordWorkflow,
} from "./application/workflows";
import { PasswordService } from "./infrastructure/adapters/password.service";
import { RetentionEnrollerAdapter } from "./infrastructure/adapters/retention-enroller.adapter";
import { TokenService } from "./infrastructure/adapters/token.service";
import { UserProvisioningSeederAdapter } from "./infrastructure/adapters/user-provisioning-seeder.adapter";
import { JwtAuthGuard, JwtRefreshGuard } from "./infrastructure/guards";
import { createOAuthProviderRegistry } from "./infrastructure/oauth/adapters";
import { OAuthTokenVerifierService } from "./infrastructure/oauth/verifier/oauth-token-verifier.service";
import {
	AccountRepository,
	LoginAttemptRepository,
	OAuthStateRepository,
	SecurityLogRepository,
	SessionRepository,
	UserRepository,
	VerificationRepository,
} from "./infrastructure/persistence";
import { AccountPurgeProcessor } from "./infrastructure/queue/account-purge.processor";
import { AccountPurgeJob } from "./infrastructure/scheduler/account-purge.job";
import { JwtRefreshStrategy, JwtStrategy } from "./infrastructure/strategies";
import {
	AccountController,
	AuthController,
	OAuthController,
	SessionController,
} from "./presentation/controllers";
import { LastActiveInterceptor } from "./presentation/interceptors/last-active.interceptor";

/**
 * 인증 모듈
 *
 * 이메일 기반 회원가입/로그인, JWT 토큰 관리, 세션 관리를 담당합니다.
 */
@Module({
	imports: [
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
		AdminNotificationModule,
		EmailModule,
		// 회원가입 기본값 시딩(설정·동의·기본 카테고리)을 파사드에 위임하기 위한 의존.
		UserSettingsModule,
		TodoCategoryModule,
		RetentionModule,
	],
	controllers: [
		AuthController,
		OAuthController,
		SessionController,
		AccountController,
	],
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
		// Services
		PasswordService,
		SessionService,
		TokenService,
		{ provide: AUTH_PASSWORD_HASHER, useExisting: PasswordService },
		{ provide: AUTH_TOKEN_ISSUER, useExisting: TokenService },
		{ provide: AUTH_CACHE, useExisting: CacheService },
		{ provide: AUTH_EMAIL_SENDER, useExisting: EmailFacade },
		{
			provide: AUTH_REGISTRATION_NOTIFIER,
			useExisting: AdminNotificationFacade,
		},
		{ provide: AUTH_RUNTIME_CONFIG, useExisting: TypedConfigService },
		VerificationService,
		OAuthTokenVerifierService,
		CredentialAuthWorkflow,
		PasswordWorkflow,
		OAuthWorkflow,
		AuthFacade,
		AccountFacade,
		SessionFacade,
		OAuthFacade,
		// Use-cases (이메일·소셜 로그인·프로비저닝 수렴)
		IssueLoginUseCase,
		ProvisionUserUseCase,
		RegisterUseCase,
		VerifyEmailUseCase,
		ResendVerificationUseCase,
		LoginWithPasswordUseCase,
		LogoutUseCase,
		LogoutAllUseCase,
		RefreshTokensUseCase,
		RequestPasswordResetUseCase,
		ResetPasswordUseCase,
		RequestPasswordSetupCodeUseCase,
		SetPasswordUseCase,
		ChangePasswordUseCase,
		GetCurrentUserQuery,
		UpdateProfileUseCase,
		DeleteAccountUseCase,
		ListLinkedAccountsQuery,
		UnlinkOAuthAccountUseCase,
		ListActiveSessionsQuery,
		RevokeSessionUseCase,
		GetOAuthRedirectUriQuery,
		StartOAuthAuthorizationUseCase,
		CompleteOAuthAuthorizationUseCase,
		LoginWithOAuthTokenUseCase,
		LinkOAuthAccountUseCase,
		LinkOAuthAccountWithCodeUseCase,
		ExchangeOAuthCodeUseCase,
		// OAuth 신원 제공자 레지스트리 (provider → 벤더 어댑터 Map)
		{
			provide: OAUTH_IDENTITY_PROVIDER_REGISTRY,
			inject: [TypedConfigService, OAuthTokenVerifierService],
			useFactory: (
				configService: TypedConfigService,
				tokenVerifier: OAuthTokenVerifierService,
			) => createOAuthProviderRegistry(configService, tokenVerifier),
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
