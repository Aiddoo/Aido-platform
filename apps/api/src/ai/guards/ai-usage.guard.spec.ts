/**
 * AiUsageGuard 가드 단위 테스트
 *
 * @description
 * AiUsageGuard의 인가 로직을 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test ai-usage.guard
 * ```
 */
import type { CurrentUserPayload } from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createMockExecutionContext } from "@test/mocks";
import { BusinessException } from "@/shared/application/exceptions/business-exception.service";

import { AiService, type UsageInfo } from "../ai.service";
import { AiUsageGuard } from "./ai-usage.guard";

describe("AiUsageGuard — AI 사용량 가드", () => {
	let guard: AiUsageGuard;
	let aiService: Mocked<AiService>;

	const createMockUsage = (used: number, limit: number | null): UsageInfo => ({
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

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(AiUsageGuard).compile();

		guard = unit;
		aiService = unitRef.get(AiService);
	});

	describe("canActivate", () => {
		it("사용자가 인증되고 사용량이 제한 미만이면 true를 반환해야 한다", async () => {
			// Given
			const { context } = createMockExecutionContext({ user: mockUser });
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
			const { context } = createMockExecutionContext();

			// When & Then
			await expect(guard.canActivate(context)).rejects.toThrow(
				BusinessException,
			);
		});

		it("사용자 정보가 없으면 AUTH_0107 에러 코드를 반환해야 한다", async () => {
			// Given
			const { context } = createMockExecutionContext();

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
			const { context } = createMockExecutionContext({ user: mockUser });
			const usage = createMockUsage(5, 5);
			aiService.getUsage.mockResolvedValue(usage);

			// When & Then
			await expect(guard.canActivate(context)).rejects.toThrow(
				BusinessException,
			);
		});

		it("사용량이 제한을 초과하면 AI_1303 에러 코드를 반환해야 한다", async () => {
			// Given
			const { context } = createMockExecutionContext({ user: mockUser });
			const usage = createMockUsage(6, 5);
			aiService.getUsage.mockResolvedValue(usage);

			// When & Then
			try {
				await guard.canActivate(context);
				fail("에러가 발생해야 합니다");
			} catch (error) {
				expect(error).toBeInstanceOf(BusinessException);
				expect((error as BusinessException).errorCode).toBe("AI_1303");
			}
		});

		it("무제한 사용자(limit: null)는 사용량에 관계없이 true를 반환해야 한다", async () => {
			// Given
			const { context, request } = createMockExecutionContext({
				user: mockUser,
			});
			const usage = createMockUsage(1000, null);
			aiService.getUsage.mockResolvedValue(usage);

			// When
			const result = await guard.canActivate(context);

			// Then
			expect(result).toBe(true);
			expect(request.aiUsage).toEqual(usage);
		});

		it("request에 aiUsage 정보를 첨부해야 한다", async () => {
			// Given
			const { context, request } = createMockExecutionContext({
				user: mockUser,
			});
			const usage = createMockUsage(3, 5);
			aiService.getUsage.mockResolvedValue(usage);

			// When
			await guard.canActivate(context);

			// Then
			expect(request.aiUsage).toEqual(usage);
		});
	});
});
