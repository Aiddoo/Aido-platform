import { ErrorCode } from "@aido/errors";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { ZodValidationPipe } from "nestjs-zod";
import request from "supertest";

import { BusinessException } from "@/common/exception/services/business-exception.service";
import { AiController } from "@/modules/ai/ai.controller";
import { AiService } from "@/modules/ai/ai.service";
import { JwtAuthGuard } from "@/modules/auth/guards";

describe("AiController (Integration)", () => {
	let app: INestApplication;
	let aiService: jest.Mocked<AiService>;

	const mockUser = {
		userId: "test-user-id",
		email: "test@example.com",
	};

	beforeAll(async () => {
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

			const response = await request(app.getHttpServer())
				.post("/ai/parse-todo")
				.send(validRequest)
				.expect(200);

			expect(response.body).toEqual({
				message: "자연어 파싱 완료",
				data: mockResult.data,
				meta: mockResult.meta,
			});

			expect(aiService.parseTodo).toHaveBeenCalledWith(validRequest.text);
		});

		it("종일 일정 파싱 성공", async () => {
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

			const response = await request(app.getHttpServer())
				.post("/ai/parse-todo")
				.send({ text: "다음주 월요일부터 금요일까지 출장" })
				.expect(200);

			expect(response.body.data.isAllDay).toBe(true);
			expect(response.body.data.endDate).toBe("2025-01-31");
		});

		it("빈 텍스트 요청 시 400 에러", async () => {
			const response = await request(app.getHttpServer())
				.post("/ai/parse-todo")
				.send({ text: "" })
				.expect(400);

			expect(response.body.message).toBeDefined();
			expect(aiService.parseTodo).not.toHaveBeenCalled();
		});

		it("text 필드 누락 시 400 에러", async () => {
			const response = await request(app.getHttpServer())
				.post("/ai/parse-todo")
				.send({})
				.expect(400);

			expect(response.body.message).toBeDefined();
			expect(aiService.parseTodo).not.toHaveBeenCalled();
		});

		it("AI 서비스 불가 시 503 에러", async () => {
			aiService.parseTodo.mockRejectedValue(
				new BusinessException(ErrorCode.AI_0001),
			);

			const response = await request(app.getHttpServer())
				.post("/ai/parse-todo")
				.send(validRequest)
				.expect(503);

			expect(response.body.error.code).toBe(ErrorCode.AI_0001);
		});

		it("파싱 실패 시 422 에러", async () => {
			aiService.parseTodo.mockRejectedValue(
				new BusinessException(ErrorCode.AI_0002, {
					details: "Invalid response format",
				}),
			);

			const response = await request(app.getHttpServer())
				.post("/ai/parse-todo")
				.send(validRequest)
				.expect(422);

			expect(response.body.error.code).toBe(ErrorCode.AI_0002);
		});

		it("너무 긴 텍스트 요청 시 400 에러", async () => {
			const longText = "a".repeat(501); // 500자 초과

			const response = await request(app.getHttpServer())
				.post("/ai/parse-todo")
				.send({ text: longText })
				.expect(400);

			expect(response.body.message).toBeDefined();
			expect(aiService.parseTodo).not.toHaveBeenCalled();
		});

		it("허용되지 않은 필드는 무시되고 정상 처리", async () => {
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

			const response = await request(app.getHttpServer())
				.post("/ai/parse-todo")
				.send({
					text: "테스트",
					unknownField: "value", // Zod의 기본 동작: strip (무시)
				})
				.expect(200);

			// 서비스가 호출되었고, unknownField는 무시됨
			expect(aiService.parseTodo).toHaveBeenCalledWith("테스트");
			expect(response.body.data.title).toBe("테스트");
		});
	});
});
