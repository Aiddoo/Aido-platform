import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { JwtModule, type JwtSignOptions } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AdminNotificationModule } from "@/admin-notification/admin-notification.module";
import { EmailModule } from "@/email/email.module";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";
import { TodoCategoryRepository } from "@/todo-category";
import {
	UserConsentRepository,
	UserPreferenceRepository,
} from "@/user-settings";
import {
	AccountController,
	AuthController,
	OAuthController,
	SessionController,
} from "./controllers";
import { JwtAuthGuard, JwtRefreshGuard } from "./guards";
import { AccountPurgeJob } from "./jobs/account-purge.job";
import {
	ACCOUNT_PURGE_QUEUE,
	AccountPurgeProcessor,
} from "./processors/account-purge.processor";
import {
	AccountRepository,
	LoginAttemptRepository,
	OAuthStateRepository,
	SecurityLogRepository,
	SessionRepository,
	UserRepository,
	VerificationRepository,
} from "./repositories";
import {
	AuthService,
	OAuthService,
	OAuthTokenVerifierService,
	PasswordManagementService,
	PasswordService,
	SessionService,
	TokenService,
	VerificationService,
} from "./services";
import { JwtRefreshStrategy, JwtStrategy } from "./strategies";

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
