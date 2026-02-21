/**
 * AiController 통합 테스트
 *
 * @description
 * AiController가 AiService와 함께 올바르게 작동하는지 검증합니다.
 * HTTP 요청/응답 흐름을 포함한 통합 테스트입니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test ai.integration-spec
 * ```
 */

import { ErrorCode } from "@aido/errors";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { suppressLogger } from "@test/setup/suppress-logger";
import { ZodValidationPipe } from "nestjs-zod";
import request from "supertest";

import { BusinessException } from "@/common/exception/services/business-exception.service";
import { AiController } from "@/modules/ai/ai.controller";
import { AiService } from "@/modules/ai/ai.service";
import { AiUsageGuard } from "@/modules/ai/guards/ai-usage.guard";
import { JwtAuthGuard } from "@/modules/auth/guards";

describe("AiController (Integration)", () => {
	let app: INestApplication;
	let aiService: jest.Mocked<AiService>;

	const mockUser = {
		userId: "test-user-id",
		email: "test@example.com",
	};

	beforeAll(async () => {
		suppressLogger();

		const mockAiService = {
			parseTodo: jest.fn(),
		};

		const moduleFixture: TestingModule = await Test.createTestingModule({
			controllers: [AiController],
			providers: [
				{
					provide: AiService,
					useValue: mockAiService,
				},
			],
		})
			.overrideGuard(JwtAuthGuard)
			.useValue({
				canActivate: (context: {
					switchToHttp: () => { getRequest: () => { user: typeof mockUser } };
				}) => {
					const req = context.switchToHttp().getRequest();
					req.user = mockUser;
					return true;
				},
			})
			.overrideGuard(AiUsageGuard)
			.useValue({
				canActivate: () => true,
			})
			.compile();

		app = moduleFixture.createNestApplication();
		app.useGlobalPipes(new ZodValidationPipe());

		await app.init();

		aiService = moduleFixture.get(AiService);
	});

	afterAll(async () => {
		await app.close();
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("POST /ai/parse-todo", () => {
		const validRequest = { text: "내일 오후 3시에 팀 미팅" };

		it("성공적으로 자연어를 파싱하여 투두 데이터 반환", async () => {
			// Given - AI 파싱 결과 설정
			const mockResult = {
				data: {
					title: "팀 미팅",
					startDate: "2025-01-26",
					endDate: null,
					scheduledTime: "15:00",
					isAllDay: false,
				},
				meta: {
					tokenUsage: { input: 150, output: 50 },
					model: "google:gemini-2.0-flash",
					processingTimeMs: 245,
				},
			};
			aiService.parseTodo.mockResolvedValue(mockResult);

			// When - API 요청
			const response = await request(app.getHttpServer())
				.post("/ai/parse-todo")
				.send(validRequest)
				.expect(200);

			// Then - 파싱 결과 반환
			expect(response.body).toEqual({
				success: true,
				data: mockResult.data,
				meta: mockResult.meta,
			});
			expect(aiService.parseTodo).toHaveBeenCalledWith(
				validRequest.text,
				mockUser.userId,
			);
		});

		it("종일 일정 파싱 성공", async () => {
			// Given - 종일 일정 파싱 결과 설정
			const mockResult = {
				data: {
					title: "출장",
					startDate: "2025-01-27",
					endDate: "2025-01-31",
					scheduledTime: null,
					isAllDay: true,
				},
				meta: {
					tokenUsage: { input: 160, output: 55 },
					model: "google:gemini-2.0-flash",
					processingTimeMs: 300,
				},
			};
			aiService.parseTodo.mockResolvedValue(mockResult);

			// When - API 요청
			const response = await request(app.getHttpServer())
				.post("/ai/parse-todo")
				.send({ text: "다음주 월요일부터 금요일까지 출장" })
				.expect(200);

			// Then - 종일 일정으로 파싱됨
			expect(response.body.data.isAllDay).toBe(true);
			expect(response.body.data.endDate).toBe("2025-01-31");
		});

		it("빈 텍스트 요청 시 400 에러", async () => {
			// Given - 빈 텍스트 요청

			// When - API 요청
			const response = await request(app.getHttpServer())
				.post("/ai/parse-todo")
				.send({ text: "" })
				.expect(400);

			// Then - 400 에러 반환
			expect(response.body.message).toBeDefined();
			expect(aiService.parseTodo).not.toHaveBeenCalled();
		});

		it("text 필드 누락 시 400 에러", async () => {
			// Given - text 필드 누락

			// When - API 요청
			const response = await request(app.getHttpServer())
				.post("/ai/parse-todo")
				.send({})
				.expect(400);

			// Then - 400 에러 반환
			expect(response.body.message).toBeDefined();
			expect(aiService.parseTodo).not.toHaveBeenCalled();
		});

		it("AI 서비스 불가 시 503 에러", async () => {
			// Given - AI 서비스 에러 설정
			aiService.parseTodo.mockRejectedValue(
				new BusinessException(ErrorCode.AI_1301),
			);

			// When - API 요청
			const response = await request(app.getHttpServer())
				.post("/ai/parse-todo")
				.send(validRequest)
				.expect(503);

			// Then - 503 에러 반환
			expect(response.body.error.code).toBe(ErrorCode.AI_1301);
		});

		it("파싱 실패 시 422 에러", async () => {
			// Given - 파싱 실패 에러 설정
			aiService.parseTodo.mockRejectedValue(
				new BusinessException(ErrorCode.AI_1302, {
					details: "Invalid response format",
				}),
			);

			// When - API 요청
			const response = await request(app.getHttpServer())
				.post("/ai/parse-todo")
				.send(validRequest)
				.expect(422);

			// Then - 422 에러 반환
			expect(response.body.error.code).toBe(ErrorCode.AI_1302);
		});

		it("너무 긴 텍스트 요청 시 400 에러", async () => {
			// Given - 500자 초과 텍스트
			const longText = "a".repeat(501);

			// When - API 요청
			const response = await request(app.getHttpServer())
				.post("/ai/parse-todo")
				.send({ text: longText })
				.expect(400);

			// Then - 400 에러 반환
			expect(response.body.message).toBeDefined();
			expect(aiService.parseTodo).not.toHaveBeenCalled();
		});

		it("허용되지 않은 필드는 무시되고 정상 처리", async () => {
			// Given - AI 파싱 결과 설정
			const mockResult = {
				data: {
					title: "테스트",
					startDate: "2025-01-25",
					endDate: null,
					scheduledTime: null,
					isAllDay: true,
				},
				meta: {
					tokenUsage: { input: 120, output: 40 },
					model: "google:gemini-2.0-flash",
					processingTimeMs: 100,
				},
			};
			aiService.parseTodo.mockResolvedValue(mockResult);

			// When - 허용되지 않은 필드 포함 요청
			const response = await request(app.getHttpServer())
				.post("/ai/parse-todo")
				.send({
					text: "테스트",
					unknownField: "value",
				})
				.expect(200);

			// Then - unknownField는 무시되고 정상 처리
			expect(aiService.parseTodo).toHaveBeenCalledWith(
				"테스트",
				mockUser.userId,
			);
			expect(response.body.data.title).toBe("테스트");
		});
	});
});
