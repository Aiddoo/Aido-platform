/**
 * E2E 테스트 앱 팩토리
 *
 * @description
 * 모든 E2E 테스트에서 반복되는 NestJS 앱 초기화 보일러플레이트를 통합합니다.
 * - TestDatabase (Testcontainers)
 * - FakeEmailService / FakeOAuthTokenVerifierService / FakeLogger
 * - ZodValidationPipe
 * - PinoLogger 억제
 */

import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PinoLogger } from "nestjs-pino";
import { ZodValidationPipe } from "nestjs-zod";
import type { App } from "supertest/types";
import { AppModule } from "@/app.module";
import { DatabaseService } from "@/database";
import { OAuthTokenVerifierService } from "@/modules/auth/services/oauth-token-verifier.service";
import { EmailService } from "@/modules/email/email.service";
import { FakeEmailService } from "../../mocks/fake-email.service";
import { FakeLogger } from "../../mocks/fake-logger.service";
import { FakeOAuthTokenVerifierService } from "../../mocks/fake-oauth-token-verifier.service";
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

	let builder = Test.createTestingModule({
		imports: [AppModule],
	})
		.overrideProvider(DatabaseService)
		.useValue(testDatabase.getPrisma())
		.overrideProvider(EmailService)
		.useValue(fakeEmailService)
		.overrideProvider(OAuthTokenVerifierService)
		.useValue(fakeOAuthTokenVerifierService)
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
