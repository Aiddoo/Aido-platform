/**
 * App E2E 테스트
 *
 * @description
 * 애플리케이션 기본 엔드포인트 테스트
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 */

import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PinoLogger } from "nestjs-pino";
import request from "supertest";
import type { App } from "supertest/types";
import { AppModule } from "@/app.module";
import { DatabaseService } from "@/database";
import { FakeLogger } from "../mocks/fake-logger.service";
import { TestDatabase } from "../setup/test-database";

describe("AppController (e2e)", () => {
	let app: INestApplication<App>;
	let testDatabase: TestDatabase;

	beforeAll(async () => {
		// Testcontainers로 PostgreSQL 컨테이너 시작
		testDatabase = new TestDatabase();
		await testDatabase.start();

		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		})
			.overrideProvider(DatabaseService)
			.useValue(testDatabase.getPrisma())
			.overrideProvider(PinoLogger)
			.useClass(FakeLogger)
			.compile();

		app = moduleFixture.createNestApplication();
		await app.init();
	});

	afterAll(async () => {
		await app.close();
		await testDatabase.stop();
	});

	it("/ (GET)", () => {
		// Given - 애플리케이션이 초기화된 상태

		// When - 루트 경로 GET 요청
		return request(app.getHttpServer())
			.get("/")
			.expect(200)
			.expect((res) => {
				// Then - 응답 검증
				// ResponseTransformInterceptor가 적용되어 래핑된 응답 확인
				expect(res.body).toMatchObject({
					success: true,
					data: "Hello World!",
				});
				expect(res.body.timestamp).toBeDefined();
			});
	});
});
