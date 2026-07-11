/**
 * AiSuggestionController 통합 테스트
 *
 * @description
 * AiSuggestionController가 AiSuggestionFacade + 매퍼와 함께 올바르게 작동하는지 검증합니다.
 * HTTP 요청/응답 흐름을 포함한 통합 테스트입니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test:integration -- ai-suggestion.integration-spec
 * ```
 */

import { ErrorCode } from "@aido/errors";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { suppressLogger } from "@test/setup/suppress-logger";
import { ZodValidationPipe } from "nestjs-zod";
import request from "supertest";
import { AiSuggestionFacade } from "@/ai-suggestion";
import {
	Suggestion,
	type SuggestionProps,
} from "@/ai-suggestion/domain/entities/suggestion.entity";
import { AiSuggestionController } from "@/ai-suggestion/presentation/ai-suggestion.controller";
import { BusinessException } from "@/shared/application/exceptions/business-exception.service";
import { ResponseTransformInterceptor } from "@/shared/presentation/interceptors/response-transform.interceptor";

function createSuggestion(overrides?: Partial<SuggestionProps>): Suggestion {
	return Suggestion.reconstitute({
		id: 1,
		userId: "test-user-id",
		title: "팀 미팅",
		daysOfWeek: ["MON", "WED", "FRI"],
		scheduledTime: "10:00",
		confidence: 0.85,
		reason: "반복 패턴",
		matchedTodos: [],
		status: "PENDING",
		suggestedCategoryId: 3,
		expiresAt: new Date("2026-03-18T00:00:00.000Z"),
		createdAt: new Date("2026-03-04T00:00:00.000Z"),
		updatedAt: new Date("2026-03-04T00:00:00.000Z"),
		...overrides,
	});
}

describe("AI 제안 통합 테스트 (Mock Facade)", () => {
	let app: INestApplication;
	let aiSuggestionFacade: jest.Mocked<AiSuggestionFacade>;

	const mockUser = {
		userId: "test-user-id",
		email: "test@example.com",
	};

	beforeAll(async () => {
		suppressLogger();

		const mockAiSuggestionFacade = {
			getPendingSuggestions: jest.fn(),
			handleAction: jest.fn(),
		};

		const mockGuard = {
			canActivate: (context: {
				switchToHttp: () => {
					getRequest: () => { user: typeof mockUser };
				};
			}) => {
				const req = context.switchToHttp().getRequest();
				req.user = mockUser;
				return true;
			},
		};

		const moduleFixture: TestingModule = await Test.createTestingModule({
			controllers: [AiSuggestionController],
			providers: [
				{
					provide: AiSuggestionFacade,
					useValue: mockAiSuggestionFacade,
				},
			],
		}).compile();

		app = moduleFixture.createNestApplication();
		app.useGlobalPipes(new ZodValidationPipe());
		app.useGlobalGuards(mockGuard as any);
		app.useGlobalInterceptors(new ResponseTransformInterceptor());

		await app.init();

		aiSuggestionFacade = moduleFixture.get(AiSuggestionFacade);
	});

	afterAll(async () => {
		await app.close();
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("GET /ai/suggestions", () => {
		it("빈 제안 목록을 성공적으로 반환", async () => {
			// Given - 빈 제안 목록 설정
			aiSuggestionFacade.getPendingSuggestions.mockResolvedValue([]);

			// When - API 요청
			const response = await request(app.getHttpServer())
				.get("/ai/suggestions")
				.expect(200);

			// Then - 빈 배열 반환
			expect(response.body).toEqual({
				success: true,
				data: { suggestions: [] },
				timestamp: expect.any(Number),
			});
			expect(aiSuggestionFacade.getPendingSuggestions).toHaveBeenCalledWith(
				mockUser.userId,
			);
		});
	});

	describe("PATCH /ai/suggestions/:id (accept)", () => {
		it("수락 시 파사드에 올바른 입력을 전달하고 결과를 반환", async () => {
			// Given - 수락 결과 설정
			aiSuggestionFacade.handleAction.mockResolvedValue({
				message: "제안이 수락되어 반복 할 일이 생성되었습니다.",
				suggestion: createSuggestion({ status: "ACCEPTED" }),
				createdTodosCount: 12,
			});

			// When - accept 액션 요청
			const response = await request(app.getHttpServer())
				.patch("/ai/suggestions/1")
				.set("X-Timezone", "Asia/Seoul")
				.send({ action: "accept", categoryId: 5 })
				.expect(200);

			// Then - 수락 결과 반환
			expect(response.body.data.createdTodosCount).toBe(12);
			expect(response.body.data.suggestion.status).toBe("ACCEPTED");
			expect(aiSuggestionFacade.handleAction).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: mockUser.userId,
					suggestionId: 1,
					action: "accept",
					categoryId: 5,
					timezone: expect.any(String),
				}),
			);
		});
	});

	describe("PATCH /ai/suggestions/:id (dismiss)", () => {
		it("거절 시 상태만 업데이트됨을 검증", async () => {
			// Given - 거절 결과 설정
			aiSuggestionFacade.handleAction.mockResolvedValue({
				message: "제안이 거절되었습니다.",
				suggestion: createSuggestion({
					id: 2,
					title: "운동",
					daysOfWeek: ["TUE", "THU"],
					scheduledTime: null,
					confidence: 0.7,
					reason: "운동 패턴",
					status: "DISMISSED",
					suggestedCategoryId: null,
				}),
			});

			// When - dismiss 액션 요청
			const response = await request(app.getHttpServer())
				.patch("/ai/suggestions/2")
				.set("X-Timezone", "Asia/Seoul")
				.send({ action: "dismiss" })
				.expect(200);

			// Then - 거절 결과 반환 (createdTodosCount 없음)
			expect(response.body.data.suggestion.status).toBe("DISMISSED");
			expect(response.body.data.createdTodosCount).toBeUndefined();
		});
	});

	describe("PATCH /ai/suggestions/:id (error)", () => {
		it("존재하지 않는 제안 시 404 에러", async () => {
			// Given - AI_1305 에러 설정
			aiSuggestionFacade.handleAction.mockRejectedValue(
				new BusinessException(ErrorCode.AI_1305, { suggestionId: 999 }),
			);

			// When - API 요청
			const response = await request(app.getHttpServer())
				.patch("/ai/suggestions/999")
				.set("X-Timezone", "Asia/Seoul")
				.send({ action: "dismiss" })
				.expect(404);

			// Then - 404 에러 반환
			expect(response.body.error.code).toBe(ErrorCode.AI_1305);
		});

		it("이미 처리된 제안 시 409 에러", async () => {
			// Given - AI_1306 에러 설정
			aiSuggestionFacade.handleAction.mockRejectedValue(
				new BusinessException(ErrorCode.AI_1306, {
					suggestionId: 1,
					currentStatus: "ACCEPTED",
				}),
			);

			// When - API 요청
			const response = await request(app.getHttpServer())
				.patch("/ai/suggestions/1")
				.set("X-Timezone", "Asia/Seoul")
				.send({ action: "accept" })
				.expect(409);

			// Then - 409 에러 반환
			expect(response.body.error.code).toBe(ErrorCode.AI_1306);
		});

		it("잘못된 action 값 시 400 에러", async () => {
			// When - API 요청
			const response = await request(app.getHttpServer())
				.patch("/ai/suggestions/1")
				.send({ action: "invalid" })
				.expect(400);

			// Then - 400 에러 반환
			expect(response.body.message).toBeDefined();
			expect(aiSuggestionFacade.handleAction).not.toHaveBeenCalled();
		});
	});
});
