/**
 * App E2E 테스트
 *
 * @description
 * 애플리케이션 기본 엔드포인트 테스트
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 */

import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types";
import { AppModule } from "@/app.module";
import { DatabaseService } from "@/database";
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
			.compile();

		app = moduleFixture.createNestApplication();
		await app.init();
	});

	afterAll(async () => {
		await app.close();
		await testDatabase.stop();
	});

	it("/ (GET)", () => {
		return request(app.getHttpServer())
			.get("/")
			.expect(200)
			.expect((res) => {
				// ResponseTransformInterceptor가 적용되어 래핑된 응답 확인
				expect(res.body).toMatchObject({
					success: true,
					data: "Hello World!",
				});
				expect(res.body.timestamp).toBeDefined();
			});
	});
});
