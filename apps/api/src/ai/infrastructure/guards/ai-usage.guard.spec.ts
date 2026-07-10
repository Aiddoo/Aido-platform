/**
 * AiUsageGuard 가드 단위 테스트
 *
 * @description
 * AiUsageGuard의 인가 로직을 격리 테스트합니다. 가드는 AiFacade만 주입받습니다.
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
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import { AiFacade } from "../../application/facades/ai.facade";
import { AiUsage } from "../../domain/value-objects/ai-usage.vo";
import { AiUsageGuard } from "./ai-usage.guard";

describe("AiUsageGuard — AI 사용량 가드", () => {
	let guard: AiUsageGuard;
	let aiFacade: Mocked<AiFacade>;

	const usageOf = (used: number, limit: number | null): AiUsage =>
		AiUsage.of(used, limit, new Date().toISOString());

	const mockUser: CurrentUserPayload = {
		userId: "user-1",
		email: "test@test.com",
		sessionId: "session-1",
		role: "USER",
	};

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(AiUsageGuard).compile();

		guard = unit;
		aiFacade = unitRef.get(AiFacade);
	});

	describe("canActivate", () => {
		it("사용자가 인증되고 사용량이 제한 미만이면 true를 반환해야 한다", async () => {
			// Given
			const { context } = createMockExecutionContext({ user: mockUser });
			aiFacade.getUsage.mockResolvedValue(usageOf(2, 5));

			// When
			const result = await guard.canActivate(context);

			// Then
			expect(result).toBe(true);
			expect(aiFacade.getUsage).toHaveBeenCalledWith(mockUser.userId);
		});

		it("사용자 정보가 없으면 AUTH_0107 ApplicationException을 던져야 한다", async () => {
			// Given
			const { context } = createMockExecutionContext();

			// When & Then
			await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
				ApplicationException,
			);
			await expect(guard.canActivate(context)).rejects.toMatchObject({
				errorCode: "AUTH_0107",
			});
		});

		it("사용량이 제한에 도달하면 AI_1303 ApplicationException을 던져야 한다", async () => {
			// Given
			const { context } = createMockExecutionContext({ user: mockUser });
			aiFacade.getUsage.mockResolvedValue(usageOf(5, 5));

			// When & Then
			await expect(guard.canActivate(context)).rejects.toMatchObject({
				errorCode: "AI_1303",
			});
		});

		it("사용량이 제한을 초과해도 AI_1303 에러 코드를 반환해야 한다", async () => {
			// Given
			const { context } = createMockExecutionContext({ user: mockUser });
			aiFacade.getUsage.mockResolvedValue(usageOf(6, 5));

			// When & Then
			await expect(guard.canActivate(context)).rejects.toMatchObject({
				errorCode: "AI_1303",
			});
		});

		it("무제한 사용자(limit: null)는 사용량에 관계없이 true를 반환해야 한다", async () => {
			// Given
			const { context } = createMockExecutionContext({ user: mockUser });
			aiFacade.getUsage.mockResolvedValue(usageOf(1000, null));

			// When
			const result = await guard.canActivate(context);

			// Then
			expect(result).toBe(true);
		});
	});
});
