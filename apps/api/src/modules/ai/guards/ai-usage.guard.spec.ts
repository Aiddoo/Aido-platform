import type { CurrentUserPayload } from "@aido/validators";
import { ExecutionContext } from "@nestjs/common";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { BusinessException } from "@/common/exception/services/business-exception.service";

import { AiService, type UsageInfo } from "../ai.service";
import { AiUsageGuard } from "./ai-usage.guard";

describe("AiUsageGuard", () => {
	let guard: AiUsageGuard;
	let aiService: Mocked<AiService>;

	// ==========================================================================
	// Mock Factory Functions
	// ==========================================================================

	const createMockExecutionContext = (user?: CurrentUserPayload) => {
		const mockRequest: Record<string, unknown> = { user };
		return {
			context: {
				switchToHttp: () => ({
					getRequest: () => mockRequest,
				}),
				getHandler: () => ({}),
				getClass: () => ({}),
			} as unknown as ExecutionContext,
			request: mockRequest,
		};
	};

	const createMockUsage = (used: number, limit: number): UsageInfo => ({
		used,
		limit,
		resetsAt: new Date().toISOString(),
	});

	const mockUser: CurrentUserPayload = {
		userId: "user-1",
		email: "test@test.com",
		sessionId: "session-1",
		role: "USER",
	};

	// ==========================================================================
	// Setup
	// ==========================================================================

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(AiUsageGuard).compile();

		guard = unit;
		aiService = unitRef.get(AiService) as unknown as Mocked<AiService>;
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	// ==========================================================================
	// canActivate
	// ==========================================================================

	describe("canActivate", () => {
		it("사용자가 인증되고 사용량이 제한 미만이면 true를 반환해야 한다", async () => {
			// Given
			const { context } = createMockExecutionContext(mockUser);
			const usage = createMockUsage(2, 5);
			aiService.getUsage.mockResolvedValue(usage);

			// When
			const result = await guard.canActivate(context);

			// Then
			expect(result).toBe(true);
			expect(aiService.getUsage).toHaveBeenCalledWith(mockUser.userId);
		});

		it("사용자 정보가 없으면 authenticationRequired 에러를 던져야 한다", async () => {
			// Given
			const { context } = createMockExecutionContext(undefined);

			// When & Then
			await expect(guard.canActivate(context)).rejects.toThrow(
				BusinessException,
			);
		});

		it("사용자 정보가 없으면 AUTH_0107 에러 코드를 반환해야 한다", async () => {
			// Given
			const { context } = createMockExecutionContext(undefined);

			// When & Then
			try {
				await guard.canActivate(context);
				fail("에러가 발생해야 합니다");
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessException);
				expect((error as BusinessException).errorCode).toBe("AUTH_0107");
			}
		});

		it("사용량이 제한에 도달하면 aiUsageLimitExceeded 에러를 던져야 한다", async () => {
			// Given
			const { context } = createMockExecutionContext(mockUser);
			const usage = createMockUsage(5, 5);
			aiService.getUsage.mockResolvedValue(usage);

			// When & Then
			await expect(guard.canActivate(context)).rejects.toThrow(
				BusinessException,
			);
		});

		it("사용량이 제한을 초과하면 AI_0003 에러 코드를 반환해야 한다", async () => {
			// Given
			const { context } = createMockExecutionContext(mockUser);
			const usage = createMockUsage(6, 5);
			aiService.getUsage.mockResolvedValue(usage);

			// When & Then
			try {
				await guard.canActivate(context);
				fail("에러가 발생해야 합니다");
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessException);
				expect((error as BusinessException).errorCode).toBe("AI_0003");
			}
		});

		it("request에 aiUsage 정보를 첨부해야 한다", async () => {
			// Given
			const { context, request } = createMockExecutionContext(mockUser);
			const usage = createMockUsage(3, 5);
			aiService.getUsage.mockResolvedValue(usage);

			// When
			await guard.canActivate(context);

			// Then
			expect(request.aiUsage).toEqual(usage);
		});
	});
});
