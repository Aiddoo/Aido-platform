/**
 * AI 모듈 E2E 테스트
 *
 * @description
 * AI 자연어 투두 파싱 API의 전체 플로우 테스트.
 * FakeAiProvider를 사용하여 실제 Gemini API 호출을 모킹합니다.
 *
 * ### 테스트 범위
 * - POST /ai/parse-todo: 자연어 파싱
 * - GET /ai/usage: 사용량 조회
 * - 일일 사용량 제한 (5회/일)
 * - 에러 처리 (400, 401, 422, 429, 503)
 */

import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { ZodValidationPipe } from "nestjs-zod";
import request from "supertest";
import type { App } from "supertest/types";

import { AppModule } from "@/app.module";
import { DatabaseService } from "@/database";
import { AI_PROVIDER } from "@/modules/ai/providers/ai.provider";
import { EmailService } from "@/modules/email/email.service";

import { FakeAiProvider } from "../mocks/fake-ai.provider";
import { FakeEmailService } from "../mocks/fake-email.service";
import { TestDatabase } from "../setup/test-database";

describe("AI (e2e)", () => {
	let app: INestApplication<App>;
	let testDatabase: TestDatabase;
	let fakeEmailService: FakeEmailService;
	let fakeAiProvider: FakeAiProvider;
	let accessToken: string;
	let testUserId: string;

	const testUser = {
		email: "ai-test@example.com",
		password: "Test1234!",
	};

	/**
	 * 테스트용 사용자 등록 및 인증 헬퍼
	 */
	async function createVerifiedUser(): Promise<{
		token: string;
		userId: string;
	}> {
		// 회원가입
		await request(app.getHttpServer())
			.post("/auth/register")
			.send({
				email: testUser.email,
				password: testUser.password,
				passwordConfirm: testUser.password,
				termsAgreed: true,
				privacyAgreed: true,
			})
			.expect(201);

		// 이메일 인증
		const code = fakeEmailService.getLastCode(testUser.email);
		const response = await request(app.getHttpServer())
			.post("/auth/verify-email")
			.send({ email: testUser.email, code })
			.expect(200);

		// 유저 ID 조회
		const prisma = testDatabase.getPrisma();
		const user = await prisma.user.findUnique({
			where: { email: testUser.email },
		});

		if (!user) {
			throw new Error("Test user not found");
		}

		return {
			token: response.body.data.accessToken,
			userId: user.id,
		};
	}

	/**
	 * 사용량 리셋 헬퍼
	 */
	async function resetUsage(userId: string): Promise<void> {
		const prisma = testDatabase.getPrisma();
		await prisma.user.update({
			where: { id: userId },
			data: {
				aiUsageCount: 0,
				aiUsageResetAt: new Date(),
			},
		});
	}

	/**
	 * 사용량 설정 헬퍼
	 */
	async function setUsage(userId: string, count: number): Promise<void> {
		const prisma = testDatabase.getPrisma();
		await prisma.user.update({
			where: { id: userId },
			data: {
				aiUsageCount: count,
				aiUsageResetAt: new Date(),
			},
		});
	}

	beforeAll(async () => {
		// Testcontainers로 PostgreSQL 컨테이너 시작
		testDatabase = new TestDatabase();
		await testDatabase.start();

		// Fake 서비스 인스턴스 생성
		fakeEmailService = new FakeEmailService();
		fakeAiProvider = new FakeAiProvider();

		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		})
			.overrideProvider(DatabaseService)
			.useValue(testDatabase.getPrisma())
			.overrideProvider(EmailService)
			.useValue(fakeEmailService)
			.overrideProvider(AI_PROVIDER)
			.useValue(fakeAiProvider)
			.compile();

		app = moduleFixture.createNestApplication();
		app.useGlobalPipes(new ZodValidationPipe());
		await app.init();

		// 테스트 사용자 생성 및 인증
		const { token, userId } = await createVerifiedUser();
		accessToken = token;
		testUserId = userId;
	}, 60000);

	afterAll(async () => {
		await app.close();
		await testDatabase.stop();
	});

	beforeEach(async () => {
		// 각 테스트 전에 FakeAiProvider 및 사용량 초기화
		fakeAiProvider.clear();
		await resetUsage(testUserId);
	});

	// ============================================
	// POST /ai/parse-todo
	// ============================================

	describe("POST /ai/parse-todo", () => {
		describe("성공 케이스", () => {
			it("인증된 사용자가 자연어를 성공적으로 파싱", async () => {
				fakeAiProvider.setResponse({
					title: "팀 미팅",
					startDate: "2025-01-26",
					scheduledTime: "15:00",
					isAllDay: false,
				});

				const response = await request(app.getHttpServer())
					.post("/ai/parse-todo")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ text: "내일 오후 3시에 팀 미팅" })
					.expect(200);

				// 글로벌 인터셉터 응답 형식 검증
				expect(response.body.success).toBe(true);
				expect(response.body.data.success).toBe(true);
				expect(response.body.data.data).toMatchObject({
					title: "팀 미팅",
					startDate: "2025-01-26",
					scheduledTime: "15:00",
					isAllDay: false,
				});

				// 메타데이터 검증
				expect(response.body.data.meta).toMatchObject({
					model: "fake:test-model",
				});
				expect(response.body.data.meta.processingTimeMs).toBeGreaterThanOrEqual(
					0,
				);
				expect(response.body.data.meta.tokenUsage).toEqual({
					input: 150,
					output: 50,
				});

				// AI Provider가 호출되었는지 검증
				expect(fakeAiProvider.getCallCount()).toBe(1);
			});

			it("종일 일정을 올바르게 파싱", async () => {
				fakeAiProvider.setResponse({
					title: "출장",
					startDate: "2025-01-27",
					endDate: "2025-01-31",
					scheduledTime: null,
					isAllDay: true,
				});

				const response = await request(app.getHttpServer())
					.post("/ai/parse-todo")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ text: "다음주 월요일부터 금요일까지 출장" })
					.expect(200);

				expect(response.body.data.data.isAllDay).toBe(true);
				expect(response.body.data.data.endDate).toBe("2025-01-31");
				expect(response.body.data.data.scheduledTime).toBeNull();
			});

			it("연속 요청 시 사용량이 증가", async () => {
				fakeAiProvider.setDefaultResponse({
					title: "테스트",
					startDate: "2025-01-26",
					isAllDay: true,
				});

				// 3회 요청
				for (let i = 0; i < 3; i++) {
					await request(app.getHttpServer())
						.post("/ai/parse-todo")
						.set("Authorization", `Bearer ${accessToken}`)
						.send({ text: `테스트 ${i + 1}` })
						.expect(200);
				}

				// 사용량 확인
				const usageResponse = await request(app.getHttpServer())
					.get("/ai/usage")
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				expect(usageResponse.body.data.data.used).toBe(3);
				expect(usageResponse.body.data.data.limit).toBe(5);
				expect(fakeAiProvider.getCallCount()).toBe(3);
			});

			it("다양한 한국어 자연어 입력을 파싱", async () => {
				const testCases = [
					{
						input: "아침 9시에 운동",
						expected: {
							title: "운동",
							startDate: "2025-01-26",
							scheduledTime: "09:00",
							isAllDay: false,
						},
					},
					{
						input: "저녁에 친구 만남",
						expected: {
							title: "친구 만남",
							startDate: "2025-01-26",
							scheduledTime: "19:00",
							isAllDay: false,
						},
					},
					{
						input: "모레 점심 약속",
						expected: {
							title: "점심 약속",
							startDate: "2025-01-27",
							scheduledTime: "12:00",
							isAllDay: false,
						},
					},
				];

				for (const testCase of testCases) {
					fakeAiProvider.setResponse(testCase.expected);

					const response = await request(app.getHttpServer())
						.post("/ai/parse-todo")
						.set("Authorization", `Bearer ${accessToken}`)
						.send({ text: testCase.input })
						.expect(200);

					expect(response.body.data.data.title).toBe(testCase.expected.title);
					expect(response.body.data.data.scheduledTime).toBe(
						testCase.expected.scheduledTime,
					);
				}

				expect(fakeAiProvider.getCallCount()).toBe(3);
			});
		});

		describe("사용량 제한", () => {
			it("5회 초과 시 429 에러 반환 (AI_0003)", async () => {
				// 5회 사용 완료 상태로 설정
				await setUsage(testUserId, 5);

				const response = await request(app.getHttpServer())
					.post("/ai/parse-todo")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ text: "테스트" })
					.expect(429);

				expect(response.body.error.code).toBe("AI_0003");
				expect(response.body.error.message).toContain(
					"일일 AI 사용 횟수를 초과",
				);

				// AI Provider가 호출되지 않았는지 검증
				expect(fakeAiProvider.getCallCount()).toBe(0);
			});

			it("정확히 5회까지는 성공, 6회째에 429 에러", async () => {
				fakeAiProvider.setDefaultResponse({
					title: "테스트",
					startDate: "2025-01-26",
					isAllDay: true,
				});

				// 5회 성공
				for (let i = 0; i < 5; i++) {
					await request(app.getHttpServer())
						.post("/ai/parse-todo")
						.set("Authorization", `Bearer ${accessToken}`)
						.send({ text: `테스트 ${i + 1}` })
						.expect(200);
				}

				// 6회째 실패
				const response = await request(app.getHttpServer())
					.post("/ai/parse-todo")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ text: "테스트 6" })
					.expect(429);

				expect(response.body.error.code).toBe("AI_0003");
				expect(fakeAiProvider.getCallCount()).toBe(5);
			});
		});

		describe("인증 에러", () => {
			it("인증 토큰 없이 요청 시 401 에러", async () => {
				await request(app.getHttpServer())
					.post("/ai/parse-todo")
					.send({ text: "내일 회의" })
					.expect(401);

				expect(fakeAiProvider.getCallCount()).toBe(0);
			});

			it("유효하지 않은 토큰으로 요청 시 401 에러", async () => {
				await request(app.getHttpServer())
					.post("/ai/parse-todo")
					.set("Authorization", "Bearer invalid-token")
					.send({ text: "내일 회의" })
					.expect(401);

				expect(fakeAiProvider.getCallCount()).toBe(0);
			});
		});

		describe("유효성 검증 에러", () => {
			it("빈 텍스트 요청 시 400 에러", async () => {
				const response = await request(app.getHttpServer())
					.post("/ai/parse-todo")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ text: "" })
					.expect(400);

				expect(response.body.success).toBe(false);
				expect(fakeAiProvider.getCallCount()).toBe(0);
			});

			it("text 필드 누락 시 400 에러", async () => {
				const response = await request(app.getHttpServer())
					.post("/ai/parse-todo")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({})
					.expect(400);

				expect(response.body.success).toBe(false);
				expect(fakeAiProvider.getCallCount()).toBe(0);
			});

			it("500자 초과 텍스트 요청 시 400 에러", async () => {
				const longText = "가".repeat(501);

				const response = await request(app.getHttpServer())
					.post("/ai/parse-todo")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ text: longText })
					.expect(400);

				expect(response.body.success).toBe(false);
				expect(fakeAiProvider.getCallCount()).toBe(0);
			});
		});

		describe("AI 서비스 에러", () => {
			it("AI 서비스 불가 시 503 에러 (AI_0001)", async () => {
				fakeAiProvider.setAvailable(false);

				const response = await request(app.getHttpServer())
					.post("/ai/parse-todo")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ text: "내일 회의" })
					.expect(503);

				expect(response.body.error.code).toBe("AI_0001");
			});

			it("AI 파싱 실패 시 422 에러 (AI_0002)", async () => {
				fakeAiProvider.setInvalidResponse(new Error("파싱 실패"));

				const response = await request(app.getHttpServer())
					.post("/ai/parse-todo")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ text: "알 수 없는 입력" })
					.expect(422);

				expect(response.body.error.code).toBe("AI_0002");
			});
		});

		describe("토큰 사용량 추적", () => {
			it("응답에 토큰 사용량이 포함됨", async () => {
				fakeAiProvider.setTokenUsage({ input: 200, output: 80 });
				fakeAiProvider.setResponse({
					title: "테스트",
					startDate: "2025-01-26",
					isAllDay: true,
				});

				const response = await request(app.getHttpServer())
					.post("/ai/parse-todo")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ text: "테스트" })
					.expect(200);

				expect(response.body.data.meta.tokenUsage).toEqual({
					input: 200,
					output: 80,
				});
			});
		});
	});

	// ============================================
	// GET /ai/usage
	// ============================================

	describe("GET /ai/usage", () => {
		describe("성공 케이스", () => {
			it("사용량이 0인 경우", async () => {
				const response = await request(app.getHttpServer())
					.get("/ai/usage")
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				expect(response.body.success).toBe(true);
				expect(response.body.data.success).toBe(true);
				expect(response.body.data.data).toMatchObject({
					used: 0,
					limit: 5,
				});
				expect(response.body.data.data.resetsAt).toBeDefined();
			});

			it("사용량이 있는 경우", async () => {
				await setUsage(testUserId, 3);

				const response = await request(app.getHttpServer())
					.get("/ai/usage")
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				expect(response.body.data.data).toMatchObject({
					used: 3,
					limit: 5,
				});
			});

			it("사용량이 최대인 경우", async () => {
				await setUsage(testUserId, 5);

				const response = await request(app.getHttpServer())
					.get("/ai/usage")
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				expect(response.body.data.data).toMatchObject({
					used: 5,
					limit: 5,
				});
			});

			it("리셋 시간이 ISO 8601 형식임", async () => {
				const response = await request(app.getHttpServer())
					.get("/ai/usage")
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				const resetsAt = response.body.data.data.resetsAt;
				expect(resetsAt).toMatch(
					/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
				);

				// 리셋 시간은 미래여야 함
				const resetDate = new Date(resetsAt);
				expect(resetDate.getTime()).toBeGreaterThan(Date.now());
			});
		});

		describe("인증 에러", () => {
			it("인증 토큰 없이 요청 시 401 에러", async () => {
				await request(app.getHttpServer()).get("/ai/usage").expect(401);
			});

			it("유효하지 않은 토큰으로 요청 시 401 에러", async () => {
				await request(app.getHttpServer())
					.get("/ai/usage")
					.set("Authorization", "Bearer invalid-token")
					.expect(401);
			});
		});
	});

	// ============================================
	// 통합 시나리오 테스트
	// ============================================

	describe("통합 시나리오", () => {
		it("파싱 요청 후 사용량이 정확히 반영됨", async () => {
			fakeAiProvider.setDefaultResponse({
				title: "테스트",
				startDate: "2025-01-26",
				isAllDay: true,
			});

			// 초기 사용량 확인
			const initialUsage = await request(app.getHttpServer())
				.get("/ai/usage")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(initialUsage.body.data.data.used).toBe(0);

			// 파싱 요청 2회
			await request(app.getHttpServer())
				.post("/ai/parse-todo")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ text: "테스트 1" })
				.expect(200);

			await request(app.getHttpServer())
				.post("/ai/parse-todo")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ text: "테스트 2" })
				.expect(200);

			// 사용량 다시 확인
			const finalUsage = await request(app.getHttpServer())
				.get("/ai/usage")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(finalUsage.body.data.data.used).toBe(2);
		});

		it("사용량 제한 후 리셋되면 다시 사용 가능", async () => {
			fakeAiProvider.setDefaultResponse({
				title: "테스트",
				startDate: "2025-01-26",
				isAllDay: true,
			});

			// 5회 사용으로 설정
			await setUsage(testUserId, 5);

			// 6번째 요청 실패
			await request(app.getHttpServer())
				.post("/ai/parse-todo")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ text: "테스트" })
				.expect(429);

			// 사용량 리셋 (자정이 지난 것처럼)
			await resetUsage(testUserId);

			// 다시 요청 성공
			const response = await request(app.getHttpServer())
				.post("/ai/parse-todo")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ text: "테스트" })
				.expect(200);

			expect(response.body.data.data.title).toBe("테스트");
		});
	});
});
