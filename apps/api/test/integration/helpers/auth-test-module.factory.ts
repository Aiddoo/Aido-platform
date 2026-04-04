/**
 * Auth 통합 테스트 모듈 팩토리
 *
 * @description
 * auth-password-setup, auth-password-change, auth-password-reset 통합 테스트에서
 * 반복되는 TestingModule 설정을 통합합니다.
 *
 * 실제 DB (Testcontainers)를 사용하는 통합 테스트용입니다.
 */

import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import { CacheService } from "@/common/cache/cache.service";
import { CACHE_SERVICE } from "@/common/cache/interfaces/cache.interface";
import { TypedConfigService } from "@/common/config/services/config.service";
import { EncryptionService } from "@/common/encryption";
import { DatabaseService } from "@/database/database.service";
import { AdminNotificationQueueService } from "@/modules/admin-notification/queue/admin-notification-queue.service";
import { AccountRepository } from "@/modules/auth/repositories/account.repository";
import { LoginAttemptRepository } from "@/modules/auth/repositories/login-attempt.repository";
import { SecurityLogRepository } from "@/modules/auth/repositories/security-log.repository";
import { SessionRepository } from "@/modules/auth/repositories/session.repository";
import { UserRepository } from "@/modules/auth/repositories/user.repository";
import { VerificationRepository } from "@/modules/auth/repositories/verification.repository";
import { AuthService } from "@/modules/auth/services/auth.service";
import { PasswordService } from "@/modules/auth/services/password.service";
import { PasswordManagementService } from "@/modules/auth/services/password-management.service";
import { SessionService } from "@/modules/auth/services/session.service";
import { TokenService } from "@/modules/auth/services/token.service";
import { VerificationService } from "@/modules/auth/services/verification.service";
import { EmailService } from "@/modules/email/email.service";
import { NotificationQueueService } from "@/modules/notification/queue";
import { TodoCategoryRepository } from "@/modules/todo-category/todo-category.repository";
import { UserConsentRepository } from "@/modules/user-settings/repositories/user-consent.repository";
import { UserPreferenceRepository } from "@/modules/user-settings/repositories/user-preference.repository";
import type { FakeEmailService } from "../../mocks/fake-email.service";

export async function createAuthTestModule(
	databaseService: DatabaseService,
	fakeEmailService: FakeEmailService,
): Promise<TestingModule> {
	return Test.createTestingModule({
		imports: [
			JwtModule.register({
				secret: process.env.JWT_SECRET,
				signOptions: { expiresIn: "15m" },
			}),
		],
		providers: [
			AuthService,
			PasswordService,
			PasswordManagementService,
			SessionService,
			TokenService,
			VerificationService,
			{
				provide: EncryptionService,
				useValue: {
					encrypt: (value: string) => value,
					decryptSafe: (value: string) => value,
				},
			},
			AccountRepository,
			UserRepository,
			SessionRepository,
			SecurityLogRepository,
			LoginAttemptRepository,
			VerificationRepository,
			UserConsentRepository,
			UserPreferenceRepository,
			TodoCategoryRepository,
			{
				provide: DatabaseService,
				useValue: databaseService,
			},
			{
				provide: EmailService,
				useValue: fakeEmailService,
			},
			{
				provide: CacheService,
				useValue: {
					invalidateSession: async () => {},
					invalidateUserProfile: async () => {},
					wrapUserProfile: async (
						_userId: string,
						fn: () => Promise<unknown>,
					) => fn(),
				},
			},
			{
				provide: CACHE_SERVICE,
				useValue: {
					get: async () => undefined,
					set: async () => {},
					del: async () => {},
				},
			},
			{
				provide: TypedConfigService,
				useValue: {
					get: (key: string) => {
						const config: Record<string, string> = {
							JWT_SECRET:
								process.env.JWT_SECRET ?? "test-jwt-secret-for-integration",
							JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "15m",
							JWT_REFRESH_SECRET:
								process.env.JWT_REFRESH_SECRET ??
								"test-jwt-refresh-secret-for-integration",
							JWT_REFRESH_EXPIRES_IN:
								process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
						};
						return config[key];
					},
					jwtSecret:
						process.env.JWT_SECRET ?? "test-jwt-secret-for-integration",
					jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
					jwtRefreshSecret:
						process.env.JWT_REFRESH_SECRET ??
						"test-jwt-refresh-secret-for-integration",
					jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
					jwtConfig: {
						secret: process.env.JWT_SECRET ?? "test-jwt-secret-for-integration",
						expiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
						refreshSecret:
							process.env.JWT_REFRESH_SECRET ??
							"test-jwt-refresh-secret-for-integration",
						refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
					},
				},
			},
			{
				provide: ConfigService,
				useValue: {
					get: (key: string) => {
						const config: Record<string, string> = {
							JWT_SECRET:
								process.env.JWT_SECRET ?? "test-jwt-secret-for-integration",
							JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "15m",
							JWT_REFRESH_SECRET:
								process.env.JWT_REFRESH_SECRET ??
								"test-jwt-refresh-secret-for-integration",
							JWT_REFRESH_EXPIRES_IN:
								process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
						};
						return config[key];
					},
				},
			},
			{
				provide: AdminNotificationQueueService,
				useValue: {
					enqueueUserRegistered: () => {},
					enqueueSubscriptionEvent: () => {},
				},
			},
			{
				provide: NotificationQueueService,
				useValue: {
					enqueueFollowNew: () => {},
					enqueueFollowMutual: () => {},
					enqueueNudgeSent: () => {},
					enqueueCheerSent: () => {},
					enqueueBillingIssue: () => {},
					enqueueTodoAllCompleted: () => {},
					enqueueFriendCompleted: () => {},
				},
			},
		],
	}).compile();
}
