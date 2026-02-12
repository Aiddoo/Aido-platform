/**
 * Inquiry E2E 테스트
 *
 * @description
 * 문의 접수 기능 전체 플로우 테스트
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 *
 * 테스트 시나리오:
 * 1. 인증된 사용자 문의 접수 성공
 * 2. 인증 없이 요청 시 401
 * 3. 잘못된 카테고리 → 400
 * 4. 내용 너무 짧음 → 400
 * 5. 각 카테고리 타입 정상 작동
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

describe("Inquiry (e2e)", () => {
	let app: INestApplication<App>;
	let testDatabase: TestDatabase;
	let fakeEmailService: FakeEmailService;
	let fakeOAuthTokenVerifierService: FakeOAuthTokenVerifierService;

	/**
	 * 테스트용 사용자 등록 및 인증 헬퍼
	 */
	async function createVerifiedUser(
		email: string,
		password: string,
	): Promise<{ accessToken: string; userId: string; userTag: string }> {
		await request(app.getHttpServer())
			.post("/auth/register")
			.send({
				email,
				password,
				passwordConfirm: password,
				termsAgreed: true,
				privacyAgreed: true,
			})
			.expect(201);

		const code = fakeEmailService.getLastCode(email);
		const response = await request(app.getHttpServer())
			.post("/auth/verify-email")
			.send({ email, code })
			.expect(200);

		return {
			accessToken: response.body.data.accessToken,
			userId: response.body.data.userId,
			userTag: response.body.data.userTag,
		};
	}

	beforeAll(async () => {
		testDatabase = new TestDatabase();
		await testDatabase.start();

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

		app = moduleFixture.createNestApplication();
		app.useGlobalPipes(new ZodValidationPipe());
		await app.init();
	}, 60000);

	afterAll(async () => {
		await app.close();
		await testDatabase.stop();
	});

	describe("POST /inquiries - 문의 접수", () => {
		const userEmail = "inquiry-user@example.com";
		const password = "Test1234!";

		let user: { accessToken: string; userId: string; userTag: string };

		beforeAll(async () => {
			user = await createVerifiedUser(userEmail, password);
		});

		it("인증된 사용자가 문의를 접수한다 (201)", async () => {
			// Given - 인증된 사용자 (beforeAll에서 생성)

			// When - 문의 접수 API 호출
			const response = await request(app.getHttpServer())
				.post("/inquiries")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({
					category: "BUG_REPORT",
					content: "앱에서 할 일 추가 시 가끔 오류가 발생합니다.",
				})
				.expect(201);

			// Then - 문의 접수 성공 검증
			expect(response.body.success).toBe(true);
			expect(response.body.data.message).toBe("문의가 접수되었습니다.");
		});

		it("FakeEmailService에 문의가 기록된다", async () => {
			// Given - 이전 테스트에서 문의 발송 완료

			// Then - FakeEmailService에 기록 확인
			const lastInquiry = fakeEmailService.getLastInquiry();
			expect(lastInquiry).toBeDefined();
			expect(lastInquiry?.data.categoryLabel).toBe("버그 신고");
		});

		it("인증 없이 요청 시 401 에러 반환", async () => {
			// Given - 인증 토큰 없음

			// When - 인증 없이 문의 접수 API 호출
			await request(app.getHttpServer())
				.post("/inquiries")
				.send({
					category: "BUG_REPORT",
					content: "앱에서 할 일 추가 시 가끔 오류가 발생합니다.",
				})
				.expect(401);

			// Then - 401 Unauthorized 응답 확인 (expect에서 검증)
		});

		it("잘못된 카테고리 시 400 에러 반환", async () => {
			// Given - 잘못된 카테고리 값

			// When - 잘못된 카테고리로 문의 접수 API 호출
			const response = await request(app.getHttpServer())
				.post("/inquiries")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({
					category: "INVALID_CATEGORY",
					content: "잘못된 카테고리 테스트입니다.",
				})
				.expect(400);

			// Then - 400 Bad Request 검증
			expect(response.body.success).toBe(false);
		});

		it("내용이 너무 짧으면 400 에러 반환", async () => {
			// Given - 너무 짧은 내용 (10자 미만)

			// When - 짧은 내용으로 문의 접수 API 호출
			const response = await request(app.getHttpServer())
				.post("/inquiries")
				.set("Authorization", `Bearer ${user.accessToken}`)
				.send({
					category: "BUG_REPORT",
					content: "짧은내용",
				})
				.expect(400);

			// Then - 400 Bad Request 검증
			expect(response.body.success).toBe(false);
		});

		describe("각 카테고리 타입 정상 작동", () => {
			it("FEATURE_REQUEST 카테고리로 문의 접수", async () => {
				// When
				const response = await request(app.getHttpServer())
					.post("/inquiries")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.send({
						category: "FEATURE_REQUEST",
						content: "새로운 기능을 추가해주시면 좋겠습니다. 상세 내용입니다.",
					})
					.expect(201);

				// Then
				expect(response.body.success).toBe(true);
				expect(response.body.data.message).toBe("문의가 접수되었습니다.");
			});

			it("OTHER 카테고리로 문의 접수", async () => {
				// When
				const response = await request(app.getHttpServer())
					.post("/inquiries")
					.set("Authorization", `Bearer ${user.accessToken}`)
					.send({
						category: "OTHER",
						content: "기타 문의 내용입니다. 상세 내용을 작성합니다.",
					})
					.expect(201);

				// Then
				expect(response.body.success).toBe(true);
				expect(response.body.data.message).toBe("문의가 접수되었습니다.");
			});
		});
	});
});
