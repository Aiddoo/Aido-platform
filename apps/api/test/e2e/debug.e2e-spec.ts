/**
 * Debug E2E 테스트 - 500 에러 원인 확인용
 *
 * TestDatabase를 사용하여 PostgreSQL 컨테이너를 시작합니다.
 */

import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { ZodValidationPipe } from "nestjs-zod";
import request from "supertest";
import type { App } from "supertest/types";
import { AppModule } from "@/app.module";
import { DatabaseService } from "@/database";
import { OAuthTokenVerifierService } from "@/modules/auth/services/oauth-token-verifier.service";
import { EmailService } from "@/modules/email/email.service";
import { FakeEmailService } from "../mocks/fake-email.service";
import { FakeOAuthTokenVerifierService } from "../mocks/fake-oauth-token-verifier.service";
import { TestDatabase } from "../setup/test-database";

describe("Debug (e2e)", () => {
	let app: INestApplication<App>;
	let testDatabase: TestDatabase;
	let fakeEmailService: FakeEmailService;
	let fakeOAuthTokenVerifierService: FakeOAuthTokenVerifierService;

	beforeAll(async () => {
		// TestDatabase로 컨테이너 시작
		testDatabase = new TestDatabase();
		await testDatabase.start();

		console.log("DATABASE_URL:", process.env.DATABASE_URL);

		fakeEmailService = new FakeEmailService();
		fakeOAuthTokenVerifierService = new FakeOAuthTokenVerifierService();

		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		})
			.overrideProvider(DatabaseService)
			.useValue(testDatabase.getPrisma())
			.overrideProvider(EmailService)
			.useValue(fakeEmailService)
			.overrideProvider(OAuthTokenVerifierService)
			.useValue(fakeOAuthTokenVerifierService)
			.compile();

		// 디버깅: DatabaseService가 어떤 연결을 사용하는지 확인
		const db = moduleFixture.get(DatabaseService);
		console.log("DatabaseService instance type:", db.constructor.name);

		app = moduleFixture.createNestApplication();
		app.useGlobalPipes(new ZodValidationPipe());
		await app.init();

		// 디버깅: 다양한 쿼리 테스트
		try {
			const userCount = await db.user.count();
			console.log("User count in test DB:", userCount);

			// findMany 테스트
			const users = await db.user.findMany();
			console.log("findMany result:", users.length);

			// findFirst 테스트 (조건 없음)
			const firstUser = await db.user.findFirst();
			console.log("findFirst (no where):", firstUser);

			// findFirst 테스트 (where 조건)
			const userByEmail = await db.user.findFirst({
				where: { email: "test@example.com" },
			});
			console.log("findFirst (where email):", userByEmail);

			// findFirst 테스트 (where null 조건)
			const activeUser = await db.user.findFirst({
				where: { deletedAt: null },
			});
			console.log("findFirst (where deletedAt null):", activeUser);
		} catch (error) {
			console.error("DB query error:", error);
		}
	}, 60000);

	afterAll(async () => {
		await app.close();
		await testDatabase.stop();
	});

	it("POST /auth/register - 에러 응답 확인", async () => {
		// Given - 테스트용 사용자 정보 준비
		const testEmail = "debug-test@example.com";
		const testPassword = "Test1234!";

		// When - 회원가입 API 호출
		const response = await request(app.getHttpServer())
			.post("/auth/register")
			.send({
				email: testEmail,
				password: testPassword,
				passwordConfirm: testPassword,
				termsAgreed: true,
				privacyAgreed: true,
				marketingAgreed: false,
			});

		// Then - 성공 응답 확인
		console.log("Response status:", response.status);
		console.log("Response body:", JSON.stringify(response.body, null, 2));

		expect(response.status).toBe(201);
	});
});
