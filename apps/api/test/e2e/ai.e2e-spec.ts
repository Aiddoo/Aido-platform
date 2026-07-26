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
 * - 월간 사용량 제한 (5회/월, KST 매월 1일 00:00 리셋)
 * - 에러 처리 (400, 401, 422, 429, 503)
 */

import request from "supertest";
import { AI_PROVIDER } from "@/ai";
import { FakeAiProvider } from "../mocks/fake-ai.provider";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers";

describe("AI E2E", () => {
	let ctx: E2eTestContext;
	let fakeAiProvider: FakeAiProvider;
	let accessToken: string;
	let testUserId: string;

	const testUser = {
		email: "ai-test@example.com",
		password: "Test1234!",
	};

	/**
	 * 사용량 리셋 헬퍼
	 */
	async function resetUsage(userId: string): Promise<void> {
		const prisma = ctx.testDatabase.getPrisma();
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
		const prisma = ctx.testDatabase.getPrisma();
		await prisma.user.update({
			where: { id: userId },
			data: {
				aiUsageCount: count,
				aiUsageResetAt: new Date(),
			},
		});
	}

	/**
	 * 사용량 + 리셋 시각 명시 설정 헬퍼 (월 경계 테스트용)
	 */
	async function setUsageWithResetAt(
		userId: string,
		count: number,
		resetAt: Date,
	): Promise<void> {
		const prisma = ctx.testDatabase.getPrisma();
		await prisma.user.update({
			where: { id: userId },
			data: {
				aiUsageCount: count,
				aiUsageResetAt: resetAt,
			},
		});
	}

	beforeAll(async () => {
		fakeAiProvider = new FakeAiProvider();

		ctx = await createE2eApp({
			customizeBuilder: (builder) =>
				builder.overrideProvider(AI_PROVIDER).useValue(fakeAiProvider),
			additionalResetters: [() => fakeAiProvider.clear()],
		});
	}, 60000);

	afterAll(async () => {
		await destroyE2eApp(ctx);
	});

	beforeEach(async () => {
		// 각 테스트 전에 DB 정리 및 사용자 재생성
		await ctx.reset();

		// 테스트 사용자 생성 및 인증
		const user = await ctx.helpers.createVerifiedUser(
			testUser.email,
			testUser.password,
		);
		accessToken = user.accessToken;
		testUserId = user.userId;
	});

	describe("POST /ai/parse-todo", () => {
		describe("성공 케이스", () => {
			it("인증된 사용자가 자연어를 성공적으로 파싱", async () => {
				// Given - 인증된 사용자와 AI 응답 설정
				fakeAiProvider.setResponse({
					title: "팀 미팅",
					startDate: "2025-01-26",
					scheduledTime: "15:00",
					isAllDay: false,
				});

				// When - 자연어 파싱 API 호출 (X-Timezone 포함)
				const response = await request(ctx.app.getHttpServer())
					.post("/v1/ai/parse-todo")
					.set("Authorization", `Bearer ${accessToken}`)
					.set("X-Timezone", "Asia/Seoul")
					.send({ text: "내일 오후 3시에 팀 미팅" });

				// Then - 파싱 결과와 메타데이터 검증
				expect(response.status).toBe(200);
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

			it("categoryId가 포함된 요청 시 응답에 categoryId가 반환됨", async () => {
				// Given - AI 응답 설정
				fakeAiProvider.setResponse({
					title: "팀 미팅",
					startDate: "2025-01-26",
					scheduledTime: "15:00",
					isAllDay: false,
				});

				// When - categoryId를 포함하여 파싱 요청
				const response = await request(ctx.app.getHttpServer())
					.post("/v1/ai/parse-todo")
					.set("Authorization", `Bearer ${accessToken}`)
					.set("X-Timezone", "Asia/Seoul")
					.send({ text: "내일 오후 3시에 팀 미팅", categoryId: 5 });

				// Then - 응답에 categoryId가 포함됨
				expect(response.status).toBe(200);
				expect(response.body.data.data.categoryId).toBe(5);
			});

			it("categoryId 없이 요청 시 응답에 categoryId가 없음", async () => {
				// Given - AI 응답 설정
				fakeAiProvider.setResponse({
					title: "팀 미팅",
					startDate: "2025-01-26",
					scheduledTime: "15:00",
					isAllDay: false,
				});

				// When - categoryId 없이 파싱 요청
				const response = await request(ctx.app.getHttpServer())
					.post("/v1/ai/parse-todo")
					.set("Authorization", `Bearer ${accessToken}`)
					.set("X-Timezone", "Asia/Seoul")
					.send({ text: "내일 오후 3시에 팀 미팅" });

				// Then - 응답에 categoryId가 없음
				expect(response.status).toBe(200);
				expect(response.body.data.data).not.toHaveProperty("categoryId");
			});

			it("종일 일정을 올바르게 파싱", async () => {
				// Given - 종일 일정 AI 응답 설정
				fakeAiProvider.setResponse({
					title: "출장",
					startDate: "2025-01-27",
					endDate: "2025-01-31",
					scheduledTime: null,
					isAllDay: true,
				});

				// When - 종일 일정 자연어 파싱 요청
				const response = await request(ctx.app.getHttpServer())
					.post("/v1/ai/parse-todo")
					.set("Authorization", `Bearer ${accessToken}`)
					.set("X-Timezone", "Asia/Seoul")
					.send({ text: "다음주 월요일부터 금요일까지 출장" });

				// Then - 종일 일정 파싱 결과 검증
				expect(response.status).toBe(200);
				expect(response.body.data.data.isAllDay).toBe(true);
				expect(response.body.data.data.endDate).toBe("2025-01-31");
				expect(response.body.data.data.scheduledTime).toBeNull();
			});

			it("연속 요청 시 사용량이 증가", async () => {
				// Given - 기본 AI 응답 설정
				fakeAiProvider.setDefaultResponse({
					title: "테스트",
					startDate: "2025-01-26",
					isAllDay: true,
				});

				// When - 3회 연속 파싱 요청
				for (let i = 0; i < 3; i++) {
					await request(ctx.app.getHttpServer())
						.post("/v1/ai/parse-todo")
						.set("Authorization", `Bearer ${accessToken}`)
						.set("X-Timezone", "Asia/Seoul")
						.send({ text: `테스트 ${i + 1}` })
						.expect(200);
				}

				// Then - 사용량이 3으로 증가
				const usageResponse = await request(ctx.app.getHttpServer())
					.get("/v1/ai/usage")
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				expect(usageResponse.body.data.data.used).toBe(3);
				expect(usageResponse.body.data.data.limit).toBe(5);
				expect(fakeAiProvider.getCallCount()).toBe(3);
			});

			it("허용되지 않은 필드는 무시되고 정상 처리", async () => {
				// Given - AI 응답 설정
				fakeAiProvider.setResponse({
					title: "테스트",
					startDate: "2025-01-25",
					scheduledTime: null,
					isAllDay: true,
				});

				// When - 허용되지 않은 필드(unknownField)를 포함하여 요청
				const response = await request(ctx.app.getHttpServer())
					.post("/v1/ai/parse-todo")
					.set("Authorization", `Bearer ${accessToken}`)
					.set("X-Timezone", "Asia/Seoul")
					.send({ text: "테스트", unknownField: "value" })
					.expect(200);

				// Then - unknownField는 Zod에 의해 제거되고 정상 처리됨
				expect(response.body.data.data.title).toBe("테스트");
				expect(fakeAiProvider.getCallCount()).toBe(1);
			});

			it("다양한 한국어 자연어 입력을 파싱", async () => {
				// Given - 다양한 테스트 케이스 준비
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

					// When - 각 자연어 입력 파싱 요청
					const response = await request(ctx.app.getHttpServer())
						.post("/v1/ai/parse-todo")
						.set("Authorization", `Bearer ${accessToken}`)
						.set("X-Timezone", "Asia/Seoul")
						.send({ text: testCase.input });

					// Then - 예상 결과와 일치하는 파싱 결과
					expect(response.status).toBe(200);
					expect(response.body.data.data.title).toBe(testCase.expected.title);
					expect(response.body.data.data.scheduledTime).toBe(
						testCase.expected.scheduledTime,
					);
				}

				expect(fakeAiProvider.getCallCount()).toBe(3);
			});
		});

		describe("사용량 제한", () => {
			it("5회 초과 시 429 에러 반환 (AI_1303)", async () => {
				// Given - 5회 사용 완료 상태 설정
				await setUsage(testUserId, 5);

				// When - 6번째 파싱 요청
				const response = await request(ctx.app.getHttpServer())
					.post("/v1/ai/parse-todo")
					.set("Authorization", `Bearer ${accessToken}`)
					.set("X-Timezone", "Asia/Seoul")
					.send({ text: "테스트" });

				// Then - 429 에러와 AI_1303 코드 반환
				expect(response.status).toBe(429);
				expect(response.body.error.code).toBe("AI_1303");
				expect(response.body.error.message).toContain(
					"월간 AI 사용 횟수를 초과",
				);

				// AI Provider가 호출되지 않았는지 검증
				expect(fakeAiProvider.getCallCount()).toBe(0);
			});

			it("지난 달 resetsAt을 가진 사용자는 이번 달 첫 요청 시 사용량이 1로 리셋된다", async () => {
				// Given - aiUsageCount=5 (소진), resetsAt은 이전 달 중간
				fakeAiProvider.setDefaultResponse({
					title: "테스트",
					startDate: "2026-05-01",
					isAllDay: true,
				});
				const now = new Date();
				const previousMonthFirstDay = new Date(
					Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
				);
				await setUsageWithResetAt(testUserId, 5, previousMonthFirstDay);

				// When - 새 달 첫 요청
				const parseResponse = await request(ctx.app.getHttpServer())
					.post("/v1/ai/parse-todo")
					.set("Authorization", `Bearer ${accessToken}`)
					.set("X-Timezone", "Asia/Seoul")
					.send({ text: "테스트" });

				// Then - 429가 아닌 정상 응답
				expect(parseResponse.status).toBe(200);

				// 사용량 조회하면 1로 리셋되어 있어야 함
				const usageResponse = await request(ctx.app.getHttpServer())
					.get("/v1/ai/usage")
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				expect(usageResponse.body.data.data.used).toBe(1);
				expect(usageResponse.body.data.data.limit).toBe(5);
			});

			it("resetsAt 필드는 KST 매월 1일 00:00 의 UTC 시각을 반환한다", async () => {
				// Given
				await setUsage(testUserId, 2);

				// When
				const response = await request(ctx.app.getHttpServer())
					.get("/v1/ai/usage")
					.set("Authorization", `Bearer ${accessToken}`)
					.expect(200);

				// Then - KST 다음 달 1일 00:00 = UTC 15:00 (offset -9)
				const resetsAt = new Date(response.body.data.data.resetsAt);
				expect(resetsAt.getUTCHours()).toBe(15);
				expect(resetsAt.getUTCMinutes()).toBe(0);
				expect(resetsAt.getUTCSeconds()).toBe(0);
				// KST 기준 다음 달 1일임을 검증
				const kstDate = new Date(resetsAt.getTime() + 9 * 60 * 60 * 1000);
				expect(kstDate.getUTCDate()).toBe(1);
			});

			it("정확히 5회까지는 성공, 6회째에 429 에러", async () => {
				// Given - 기본 AI 응답 설정
				fakeAiProvider.setDefaultResponse({
					title: "테스트",
					startDate: "2025-01-26",
					isAllDay: true,
				});

				// When - 5회 연속 요청
				for (let i = 0; i < 5; i++) {
					await request(ctx.app.getHttpServer())
						.post("/v1/ai/parse-todo")
						.set("Authorization", `Bearer ${accessToken}`)
						.set("X-Timezone", "Asia/Seoul")
						.send({ text: `테스트 ${i + 1}` })
						.expect(200);
				}

				// Then - 6회째 요청 시 429 에러
				const response = await request(ctx.app.getHttpServer())
					.post("/v1/ai/parse-todo")
					.set("Authorization", `Bearer ${accessToken}`)
					.set("X-Timezone", "Asia/Seoul")
					.send({ text: "테스트 6" });

				expect(response.status).toBe(429);
				expect(response.body.error.code).toBe("AI_1303");
				expect(fakeAiProvider.getCallCount()).toBe(5);
			});
		});

		describe("인증 에러", () => {
			it("인증 토큰 없이 요청 시 401 에러", async () => {
				// Given - 인증 토큰 없음

				// When - 토큰 없이 파싱 요청
				const response = await request(ctx.app.getHttpServer())
					.post("/v1/ai/parse-todo")
					.send({ text: "내일 회의" });

				// Then - 401 Unauthorized 반환
				expect(response.status).toBe(401);
				expect(fakeAiProvider.getCallCount()).toBe(0);
			});

			it("유효하지 않은 토큰으로 요청 시 401 에러", async () => {
				// Given - 유효하지 않은 토큰

				// When - 잘못된 토큰으로 파싱 요청
				const response = await request(ctx.app.getHttpServer())
					.post("/v1/ai/parse-todo")
					.set("Authorization", "Bearer invalid-token")
					.send({ text: "내일 회의" });

				// Then - 401 Unauthorized 반환
				expect(response.status).toBe(401);
				expect(fakeAiProvider.getCallCount()).toBe(0);
			});
		});

		describe("유효성 검증 에러", () => {
			it("빈 텍스트 요청 시 400 에러", async () => {
				// Given - 인증된 사용자

				// When - 빈 텍스트로 파싱 요청
				const response = await request(ctx.app.getHttpServer())
					.post("/v1/ai/parse-todo")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ text: "" });

				// Then - 400 Bad Request 반환
				expect(response.status).toBe(400);
				expect(response.body.success).toBe(false);
				expect(fakeAiProvider.getCallCount()).toBe(0);
			});

			it("text 필드 누락 시 400 에러", async () => {
				// Given - 인증된 사용자

				// When - text 필드 없이 파싱 요청
				const response = await request(ctx.app.getHttpServer())
					.post("/v1/ai/parse-todo")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({});

				// Then - 400 Bad Request 반환
				expect(response.status).toBe(400);
				expect(response.body.success).toBe(false);
				expect(fakeAiProvider.getCallCount()).toBe(0);
			});

			it("500자 초과 텍스트 요청 시 400 에러", async () => {
				// Given - 500자 초과 텍스트 준비
				const longText = "가".repeat(501);

				// When - 긴 텍스트로 파싱 요청
				const response = await request(ctx.app.getHttpServer())
					.post("/v1/ai/parse-todo")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ text: longText });

				// Then - 400 Bad Request 반환
				expect(response.status).toBe(400);
				expect(response.body.success).toBe(false);
				expect(fakeAiProvider.getCallCount()).toBe(0);
			});
		});

		describe("AI 서비스 에러", () => {
			it("AI 서비스 불가 시 503 에러 (AI_1301)", async () => {
				// Given - AI 서비스 비활성화 설정
				fakeAiProvider.setAvailable(false);

				// When - 파싱 요청
				const response = await request(ctx.app.getHttpServer())
					.post("/v1/ai/parse-todo")
					.set("Authorization", `Bearer ${accessToken}`)
					.set("X-Timezone", "Asia/Seoul")
					.send({ text: "내일 회의" });

				// Then - 503 Service Unavailable 반환
				expect(response.status).toBe(503);
				expect(response.body.error.code).toBe("AI_1301");
			});

			it("AI 파싱 실패 시 422 에러 (AI_1302)", async () => {
				// Given - AI 파싱 실패 설정
				fakeAiProvider.setInvalidResponse(new Error("파싱 실패"));

				// When - 파싱 요청
				const response = await request(ctx.app.getHttpServer())
					.post("/v1/ai/parse-todo")
					.set("Authorization", `Bearer ${accessToken}`)
					.set("X-Timezone", "Asia/Seoul")
					.send({ text: "알 수 없는 입력" });

				// Then - 422 Unprocessable Entity 반환
				expect(response.status).toBe(422);
				expect(response.body.error.code).toBe("AI_1302");
			});
		});

		describe("토큰 사용량 추적", () => {
			it("응답에 토큰 사용량이 포함됨", async () => {
				// Given - 커스텀 토큰 사용량과 AI 응답 설정
				fakeAiProvider.setTokenUsage({ input: 200, output: 80 });
				fakeAiProvider.setResponse({
					title: "테스트",
					startDate: "2025-01-26",
					isAllDay: true,
				});

				// When - 파싱 요청
				const response = await request(ctx.app.getHttpServer())
					.post("/v1/ai/parse-todo")
					.set("Authorization", `Bearer ${accessToken}`)
					.set("X-Timezone", "Asia/Seoul")
					.send({ text: "테스트" });

				// Then - 설정한 토큰 사용량이 응답에 포함
				expect(response.status).toBe(200);
				expect(response.body.data.meta.tokenUsage).toEqual({
					input: 200,
					output: 80,
				});
			});
		});
	});

	describe("GET /ai/usage", () => {
		describe("성공 케이스", () => {
			it("사용량이 0인 경우", async () => {
				// Given - 사용량 0인 상태 (beforeEach에서 리셋됨)

				// When - 사용량 조회
				const response = await request(ctx.app.getHttpServer())
					.get("/v1/ai/usage")
					.set("Authorization", `Bearer ${accessToken}`);

				// Then - 0/5 사용량 반환
				expect(response.status).toBe(200);
				expect(response.body.success).toBe(true);
				expect(response.body.data.success).toBe(true);
				expect(response.body.data.data).toMatchObject({
					used: 0,
					limit: 5,
				});
				expect(response.body.data.data.resetsAt).toBeDefined();
			});

			it("사용량이 있는 경우", async () => {
				// Given - 3회 사용 상태 설정
				await setUsage(testUserId, 3);

				// When - 사용량 조회
				const response = await request(ctx.app.getHttpServer())
					.get("/v1/ai/usage")
					.set("Authorization", `Bearer ${accessToken}`);

				// Then - 3/5 사용량 반환
				expect(response.status).toBe(200);
				expect(response.body.data.data).toMatchObject({
					used: 3,
					limit: 5,
				});
			});

			it("사용량이 최대인 경우", async () => {
				// Given - 5회 사용 완료 상태 설정
				await setUsage(testUserId, 5);

				// When - 사용량 조회
				const response = await request(ctx.app.getHttpServer())
					.get("/v1/ai/usage")
					.set("Authorization", `Bearer ${accessToken}`);

				// Then - 5/5 사용량 반환
				expect(response.status).toBe(200);
				expect(response.body.data.data).toMatchObject({
					used: 5,
					limit: 5,
				});
			});

			it("리셋 시간이 ISO 8601 형식임", async () => {
				// Given - 인증된 사용자

				// When - 사용량 조회
				const response = await request(ctx.app.getHttpServer())
					.get("/v1/ai/usage")
					.set("Authorization", `Bearer ${accessToken}`);

				// Then - ISO 8601 형식의 리셋 시간 반환
				expect(response.status).toBe(200);
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
				// Given - 인증 토큰 없음

				// When - 토큰 없이 사용량 조회
				const response = await request(ctx.app.getHttpServer()).get(
					"/v1/ai/usage",
				);

				// Then - 401 Unauthorized 반환
				expect(response.status).toBe(401);
			});

			it("유효하지 않은 토큰으로 요청 시 401 에러", async () => {
				// Given - 유효하지 않은 토큰

				// When - 잘못된 토큰으로 사용량 조회
				const response = await request(ctx.app.getHttpServer())
					.get("/v1/ai/usage")
					.set("Authorization", "Bearer invalid-token");

				// Then - 401 Unauthorized 반환
				expect(response.status).toBe(401);
			});
		});
	});

	describe("타임존 처리", () => {
		it("X-Timezone 헤더가 프롬프트에 반영된다", async () => {
			// Given
			fakeAiProvider.setResponse({
				title: "테스트",
				startDate: "2025-01-26",
				isAllDay: true,
			});

			// When - Asia/Seoul 타임존으로 요청
			await request(ctx.app.getHttpServer())
				.post("/v1/ai/parse-todo")
				.set("Authorization", `Bearer ${accessToken}`)
				.set("X-Timezone", "Asia/Seoul")
				.send({ text: "테스트" })
				.expect(200);

			// Then - 프롬프트에 사용자 입력이 포함됨
			const prompt = fakeAiProvider.getLastPrompt();
			expect(prompt).toContain("테스트");
			const system = fakeAiProvider.getLastSystem();
			expect(system).toContain("한국어 자연어 입력을 구조화된 할 일");
		});

		it("X-Timezone 헤더 없이도 정상 동작한다 (UTC 폴백)", async () => {
			// Given
			fakeAiProvider.setResponse({
				title: "테스트",
				startDate: "2025-01-26",
				isAllDay: true,
			});

			// When - X-Timezone 없이 요청
			const response = await request(ctx.app.getHttpServer())
				.post("/v1/ai/parse-todo")
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ text: "테스트" });

			// Then - 정상 응답
			expect(response.status).toBe(200);
			expect(response.body.data.data.title).toBe("테스트");
		});
	});

	describe("통합 시나리오", () => {
		it("파싱 요청 후 사용량이 정확히 반영됨", async () => {
			// Given - 기본 AI 응답 설정
			fakeAiProvider.setDefaultResponse({
				title: "테스트",
				startDate: "2025-01-26",
				isAllDay: true,
			});

			// When - 초기 사용량 확인
			const initialUsage = await request(ctx.app.getHttpServer())
				.get("/v1/ai/usage")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			// Then - 초기 사용량 0
			expect(initialUsage.body.data.data.used).toBe(0);

			// When - 파싱 요청 2회
			await request(ctx.app.getHttpServer())
				.post("/v1/ai/parse-todo")
				.set("Authorization", `Bearer ${accessToken}`)
				.set("X-Timezone", "Asia/Seoul")
				.send({ text: "테스트 1" })
				.expect(200);

			await request(ctx.app.getHttpServer())
				.post("/v1/ai/parse-todo")
				.set("Authorization", `Bearer ${accessToken}`)
				.set("X-Timezone", "Asia/Seoul")
				.send({ text: "테스트 2" })
				.expect(200);

			// Then - 사용량 2로 증가
			const finalUsage = await request(ctx.app.getHttpServer())
				.get("/v1/ai/usage")
				.set("Authorization", `Bearer ${accessToken}`)
				.expect(200);

			expect(finalUsage.body.data.data.used).toBe(2);
		});

		it("사용량 제한 후 리셋되면 다시 사용 가능", async () => {
			// Given - 기본 AI 응답과 5회 사용 완료 상태 설정
			fakeAiProvider.setDefaultResponse({
				title: "테스트",
				startDate: "2025-01-26",
				isAllDay: true,
			});
			await setUsage(testUserId, 5);

			// When - 6번째 요청 시도
			const failedResponse = await request(ctx.app.getHttpServer())
				.post("/v1/ai/parse-todo")
				.set("Authorization", `Bearer ${accessToken}`)
				.set("X-Timezone", "Asia/Seoul")
				.send({ text: "테스트" });

			// Then - 429 에러 반환
			expect(failedResponse.status).toBe(429);

			// When - 사용량 리셋 후 다시 요청
			await resetUsage(testUserId);
			const response = await request(ctx.app.getHttpServer())
				.post("/v1/ai/parse-todo")
				.set("Authorization", `Bearer ${accessToken}`)
				.set("X-Timezone", "Asia/Seoul")
				.send({ text: "테스트" });

			// Then - 요청 성공
			expect(response.status).toBe(200);
			expect(response.body.data.data.title).toBe("테스트");
		});
	});

	describe("POST /ai/parse-memo", () => {
		describe("성공 케이스", () => {
			it("메모를 다중 Todo+SubTodo로 파싱", async () => {
				// Given
				fakeAiProvider.setRawResponse({
					todos: [
						{
							title: "버그 수정",
							startDate: "2026-04-12",
							endDate: null,
							scheduledTime: "14:00",
							isAllDay: false,
							isRecurring: false,
							recurrence: null,
							items: [{ title: "로그 확인" }],
						},
						{
							title: "자료 올리기",
							startDate: "2026-04-11",
							endDate: null,
							scheduledTime: null,
							isAllDay: true,
							isRecurring: false,
							recurrence: null,
							items: [],
						},
					],
				});

				// When
				const response = await request(ctx.app.getHttpServer())
					.post("/v1/ai/parse-memo")
					.set("Authorization", `Bearer ${accessToken}`)
					.set("X-Timezone", "Asia/Seoul")
					.send({ content: "내일 2시 버그 수정, 자료 올리기", categoryId: 1 });

				// Then
				expect(response.status).toBe(200);
				expect(response.body.data.data.todos).toHaveLength(2);
				expect(response.body.data.data.todos[0]).toMatchObject({
					title: "버그 수정",
					scheduledTime: "14:00",
					categoryId: 1,
				});
				expect(response.body.data.data.todos[0].items).toHaveLength(1);
				expect(response.body.data.data.todos[1]).toMatchObject({
					title: "자료 올리기",
					isAllDay: true,
					categoryId: 1,
				});
			});

			it("categoryId가 모든 todo에 주입됨", async () => {
				// Given
				fakeAiProvider.setRawResponse({
					todos: [
						{
							title: "할 일",
							startDate: "2026-04-11",
							endDate: null,
							scheduledTime: null,
							isAllDay: true,
							isRecurring: false,
							recurrence: null,
							items: [],
						},
					],
				});

				// When
				const response = await request(ctx.app.getHttpServer())
					.post("/v1/ai/parse-memo")
					.set("Authorization", `Bearer ${accessToken}`)
					.set("X-Timezone", "Asia/Seoul")
					.send({ content: "할 일", categoryId: 42 });

				// Then
				expect(response.status).toBe(200);
				expect(response.body.data.data.todos[0].categoryId).toBe(42);
			});

			it("파싱 후 사용량이 1 증가", async () => {
				// Given
				fakeAiProvider.setRawResponse({
					todos: [
						{
							title: "테스트",
							startDate: "2026-04-11",
							endDate: null,
							scheduledTime: null,
							isAllDay: true,
							isRecurring: false,
							recurrence: null,
							items: [],
						},
					],
				});
				await resetUsage(testUserId);

				// When
				await request(ctx.app.getHttpServer())
					.post("/v1/ai/parse-memo")
					.set("Authorization", `Bearer ${accessToken}`)
					.set("X-Timezone", "Asia/Seoul")
					.send({ content: "테스트", categoryId: 1 });

				const usageResponse = await request(ctx.app.getHttpServer())
					.get("/v1/ai/usage")
					.set("Authorization", `Bearer ${accessToken}`);

				// Then
				expect(usageResponse.body.data.data.used).toBe(1);
			});
		});

		describe("에러 케이스", () => {
			it("인증 없이 요청 시 401", async () => {
				const response = await request(ctx.app.getHttpServer())
					.post("/v1/ai/parse-memo")
					.send({ content: "테스트", categoryId: 1 });

				expect(response.status).toBe(401);
			});

			it("빈 content 시 400", async () => {
				const response = await request(ctx.app.getHttpServer())
					.post("/v1/ai/parse-memo")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ content: "", categoryId: 1 });

				expect(response.status).toBe(400);
			});

			it("categoryId 누락 시 400", async () => {
				const response = await request(ctx.app.getHttpServer())
					.post("/v1/ai/parse-memo")
					.set("Authorization", `Bearer ${accessToken}`)
					.send({ content: "테스트" });

				expect(response.status).toBe(400);
			});

			it("사용량 초과 시 429", async () => {
				// Given
				await setUsage(testUserId, 5);

				// When
				const response = await request(ctx.app.getHttpServer())
					.post("/v1/ai/parse-memo")
					.set("Authorization", `Bearer ${accessToken}`)
					.set("X-Timezone", "Asia/Seoul")
					.send({ content: "테스트", categoryId: 1 });

				// Then
				expect(response.status).toBe(429);
				expect(response.body.error.code).toBe("AI_1303");
			});
		});
	});
});
