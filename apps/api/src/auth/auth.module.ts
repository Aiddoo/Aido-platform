import { BullModule } from "@nestjs/bullmq";
import { Logger, Module } from "@nestjs/common";
import { JwtModule, type JwtSignOptions } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AdminNotificationModule } from "@/admin-notification/admin-notification.module";
import { EmailModule } from "@/email/email.module";
import type { AccountProvider } from "@/generated/prisma/client";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";
import { TodoCategoryRepository } from "@/todo-category";
import {
	UserConsentRepository,
	UserPreferenceRepository,
} from "@/user-settings";
import {
	OAUTH_IDENTITY_PROVIDER_REGISTRY,
	type OAuthIdentityProvider,
	type OAuthIdentityProviderRegistry,
} from "./application/ports/oauth-identity-provider.port";
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
		UserConsentRepository,
		UserPreferenceRepository,
		TodoCategoryRepository,
		// Services
		PasswordService,
		SessionService,
		TokenService,
		VerificationService,
		OAuthTokenVerifierService,
		AuthService,
		PasswordManagementService,
		OAuthService,
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
