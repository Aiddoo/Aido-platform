import { BullModule } from "@nestjs/bullmq";
import { Logger, Module } from "@nestjs/common";
import { JwtModule, type JwtSignOptions } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AdminNotificationModule } from "@/admin-notification/admin-notification.module";
import { EmailModule } from "@/email/email.module";
import type { AccountProvider } from "@/generated/prisma/client";
import { RetentionModule } from "@/retention";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";
import { TodoCategoryModule } from "@/todo-category";
import { UserSettingsModule } from "@/user-settings";
import {
	OAUTH_IDENTITY_PROVIDER_REGISTRY,
	type OAuthIdentityProvider,
	type OAuthIdentityProviderRegistry,
} from "./application/ports/oauth-identity-provider.port";
import { RETENTION_ENROLLER } from "./application/ports/retention-enroller.port";
import { USER_PROVISIONING_SEEDER } from "./application/ports/user-provisioning-seeder.port";
import {
	AuthService,
	OAuthService,
	OAuthTokenVerifierService,
	PasswordManagementService,
	PasswordService,
	SessionService,
	TokenService,
	VerificationService,
} from "./application/services";
import { IssueLoginUseCase } from "./application/use-cases/issue-login/issue-login.use-case";
import { ProvisionUserUseCase } from "./application/use-cases/provision-user/provision-user.use-case";
import { RetentionEnrollerAdapter } from "./infrastructure/adapters/retention-enroller.adapter";
import { UserProvisioningSeederAdapter } from "./infrastructure/adapters/user-provisioning-seeder.adapter";
import { JwtAuthGuard, JwtRefreshGuard } from "./infrastructure/guards";
import {
	AppleOAuthProvider,
	GoogleOAuthProvider,
	KakaoOAuthProvider,
	NaverOAuthProvider,
} from "./infrastructure/oauth/adapters";
import {
	AccountRepository,
	LoginAttemptRepository,
	OAuthStateRepository,
	SecurityLogRepository,
	SessionRepository,
	UserRepository,
	VerificationRepository,
} from "./infrastructure/persistence";
import {
	ACCOUNT_PURGE_QUEUE,
	AccountPurgeProcessor,
} from "./infrastructure/queue/account-purge.processor";
import { AccountPurgeJob } from "./infrastructure/scheduler/account-purge.job";
import { JwtRefreshStrategy, JwtStrategy } from "./infrastructure/strategies";
import {
	AccountController,
	AuthController,
	OAuthController,
	SessionController,
} from "./presentation/controllers";

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
		BullModule.registerQueue({ name: ACCOUNT_PURGE_QUEUE }),
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
		VerificationService,
		OAuthTokenVerifierService,
		AuthService,
		PasswordManagementService,
		OAuthService,
		// Use-cases (이메일·소셜 로그인·프로비저닝 수렴)
		IssueLoginUseCase,
		ProvisionUserUseCase,
		// OAuth 신원 제공자 레지스트리 (provider → 벤더 어댑터 Map)
		{
			provide: OAUTH_IDENTITY_PROVIDER_REGISTRY,
			inject: [TypedConfigService, OAuthTokenVerifierService],
			useFactory: (
				configService: TypedConfigService,
				tokenVerifier: OAuthTokenVerifierService,
			): OAuthIdentityProviderRegistry => {
				const logger = new Logger("OAuthIdentityProvider");
				return new Map<AccountProvider, OAuthIdentityProvider>([
					["APPLE", new AppleOAuthProvider(tokenVerifier)],
					[
						"GOOGLE",
						new GoogleOAuthProvider(
							() => configService.googleOAuth,
							tokenVerifier,
							logger,
						),
					],
					[
						"KAKAO",
						new KakaoOAuthProvider(
							() => configService.kakaoOAuth,
							tokenVerifier,
							logger,
						),
					],
					[
						"NAVER",
						new NaverOAuthProvider(
							() => configService.naverOAuth,
							tokenVerifier,
							logger,
						),
					],
				]);
			},
		},
		// Strategies
		JwtStrategy,
		JwtRefreshStrategy,
		// Guards
		JwtAuthGuard,
		JwtRefreshGuard,
		// Jobs
		AccountPurgeJob,
		AccountPurgeProcessor,
	],
	exports: [AuthService, JwtAuthGuard, JwtRefreshGuard, UserRepository],
})
export class AuthModule {}
