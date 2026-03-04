/**
 * E2E 테스트 앱 팩토리
 *
 * @description
 * 모든 E2E 테스트에서 반복되는 NestJS 앱 초기화 보일러플레이트를 통합합니다.
 * - TestDatabase (Testcontainers)
 * - 외부 서비스 Fake 처리 (Email, OAuth, Push, AI, Discord)
 * - ZodValidationPipe
 * - PinoLogger 억제
 */

import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import RedisMock from "ioredis-mock";
import { PinoLogger } from "nestjs-pino";
import { ZodValidationPipe } from "nestjs-zod";
import type { App } from "supertest/types";
import { AppModule } from "@/app.module";
import { REDIS_CLIENT } from "@/common/redis/redis.constants";
import { DatabaseService } from "@/database";
import {
	ADMIN_NOTIFIER,
	PAYMENT_NOTIFIER,
} from "@/modules/admin-notification/providers/admin-notifier.interface";
import { AI_PROVIDER } from "@/modules/ai/providers/ai.provider";
import { OAuthTokenVerifierService } from "@/modules/auth/services/oauth-token-verifier.service";
import { EmailService } from "@/modules/email/email.service";
import { PUSH_PROVIDER } from "@/modules/notification/providers/push-provider.interface";
import { FakeAdminNotifier } from "../../mocks/fake-admin-notifier";
import { FakeAiProvider } from "../../mocks/fake-ai.provider";
import { FakeEmailService } from "../../mocks/fake-email.service";
import { FakeLogger } from "../../mocks/fake-logger.service";
import { FakeOAuthTokenVerifierService } from "../../mocks/fake-oauth-token-verifier.service";
import { FakePushProvider } from "../../mocks/fake-push.provider";
import { TestDatabase } from "../../setup/test-database";
import { E2eHelpers } from "./e2e-helpers";

export interface E2eTestContext {
	app: INestApplication<App>;
	module: TestingModule;
	testDatabase: TestDatabase;
	fakeEmailService: FakeEmailService;
	fakeOAuthTokenVerifierService: FakeOAuthTokenVerifierService;
	helpers: E2eHelpers;
}

export interface E2eAppOptions {
	/** 추가 provider override 콜백 */
	customizeBuilder?: (
		builder: ReturnType<typeof Test.createTestingModule>,
	) => ReturnType<typeof Test.createTestingModule>;
}

export async function createE2eApp(
	options?: E2eAppOptions,
): Promise<E2eTestContext> {
	const testDatabase = new TestDatabase();
	await testDatabase.start();

	const fakeEmailService = new FakeEmailService();
	const fakeOAuthTokenVerifierService = new FakeOAuthTokenVerifierService();
	const fakeAdminNotifier = new FakeAdminNotifier();
	const fakePaymentNotifier = new FakeAdminNotifier();
	const fakePushProvider = new FakePushProvider();
	const fakeAiProvider = new FakeAiProvider();

	const redisMock = new RedisMock();

	let builder = Test.createTestingModule({
		imports: [AppModule],
	})
		.overrideProvider(REDIS_CLIENT)
		.useValue(redisMock)
		.overrideProvider(DatabaseService)
		.useValue(testDatabase.getPrisma())
		.overrideProvider(EmailService)
		.useValue(fakeEmailService)
		.overrideProvider(OAuthTokenVerifierService)
		.useValue(fakeOAuthTokenVerifierService)
		.overrideProvider(ADMIN_NOTIFIER)
		.useValue(fakeAdminNotifier)
		.overrideProvider(PAYMENT_NOTIFIER)
		.useValue(fakePaymentNotifier)
		.overrideProvider(PUSH_PROVIDER)
		.useValue(fakePushProvider)
		.overrideProvider(AI_PROVIDER)
		.useValue(fakeAiProvider)
		.overrideProvider(PinoLogger)
		.useClass(FakeLogger);

	if (options?.customizeBuilder) {
		builder = options.customizeBuilder(builder);
	}

	const module = await builder.compile();

	const app = module.createNestApplication();
	app.useGlobalPipes(new ZodValidationPipe());
	await app.init();

	const helpers = new E2eHelpers(app, fakeEmailService);

	return {
		app,
		module,
		testDatabase,
		fakeEmailService,
		fakeOAuthTokenVerifierService,
		helpers,
	};
}

export async function destroyE2eApp(ctx: E2eTestContext): Promise<void> {
	await ctx.app.close();
	await ctx.testDatabase.stop();
}
