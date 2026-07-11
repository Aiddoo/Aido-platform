/**
 * AiController 컨트롤러 단위 테스트
 *
 * @description
 * AiController의 엔드포인트 핸들러를 격리 테스트합니다. 컨트롤러는 AiFacade만
 * 주입받습니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test ai.controller
 * ```
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "../../auth/presentation/decorators";

import { AiFacade } from "../application/facades/ai.facade";
import { AiUsage } from "../domain/value-objects/ai-usage.vo";
import { AiController } from "./ai.controller";

describe("AiController — AI 컨트롤러", () => {
	let controller: AiController;
	let mockAiFacade: Mocked<AiFacade>;

	const mockUser: CurrentUserPayload = {
		userId: "user-123",
		email: "test@example.com",
		sessionId: "session-123",
		role: "USER",
	};

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(AiController).compile();

		controller = unit;
		mockAiFacade = unitRef.get(AiFacade);
	});

	describe("parseTodo", () => {
		it("자연어 텍스트를 Facade에 위임하고 파싱 결과를 반환해야 한다", async () => {
			// Given - 자연어 텍스트와 Facade 응답이 준비되었을 때
			const dto = { text: "내일 오후 3시에 팀 미팅" };
			const facadeResult = {
				data: {
					title: "팀 미팅",
					startDate: "2026-02-22",
					endDate: null,
					scheduledTime: "15:00",
					isAllDay: false,
					isRecurring: false,
					recurrence: null,
				},
				meta: {
					model: "google:gemini-3.1-flash-lite",
					processingTimeMs: 185,
					tokenUsage: { input: 180, output: 45 },
				},
			};
			mockAiFacade.parseTodo.mockResolvedValue(facadeResult);

			// When - parseTodo를 호출하면
			const result = await controller.parseTodo(
				mockUser,
				dto,
				"Asia/Seoul",
				undefined,
			);

			// Then - Facade에 text, userId, timezone, categoryId를 전달하고 성공 응답을 반환해야 한다
			expect(mockAiFacade.parseTodo).toHaveBeenCalledWith(
				dto.text,
				mockUser.userId,
				"Asia/Seoul",
				undefined,
				undefined,
			);
			expect(result).toEqual({
				success: true,
				data: facadeResult.data,
				meta: facadeResult.meta,
			});
		});

		it("categoryId가 포함된 요청을 Facade에 전달해야 한다", async () => {
			// Given - categoryId가 포함된 요청
			const dto = { text: "내일 오후 3시에 팀 미팅", categoryId: 42 };
			const facadeResult = {
				data: {
					title: "팀 미팅",
					startDate: "2026-02-22",
					endDate: null,
					scheduledTime: "15:00",
					isAllDay: false,
					isRecurring: false,
					recurrence: null,
					categoryId: 42,
				},
				meta: {
					model: "google:gemini-3.1-flash-lite",
					processingTimeMs: 185,
					tokenUsage: { input: 180, output: 45 },
				},
			};
			mockAiFacade.parseTodo.mockResolvedValue(facadeResult);

			// When - parseTodo를 호출하면
			const result = await controller.parseTodo(
				mockUser,
				dto,
				"Asia/Seoul",
				undefined,
			);

			// Then - categoryId가 Facade에 전달되고 응답에 포함되어야 한다
			expect(mockAiFacade.parseTodo).toHaveBeenCalledWith(
				dto.text,
				mockUser.userId,
				"Asia/Seoul",
				42,
				undefined,
			);
			expect(result.data.categoryId).toBe(42);
		});
	});

	describe("getUsage", () => {
		it("AI 사용량을 Facade에서 조회하고 평면 뷰를 반환해야 한다", async () => {
			// Given - 사용량 조회 Facade 응답이 준비되었을 때
			const usage = AiUsage.of(3, 5, "2026-02-22T15:00:00.000Z");
			mockAiFacade.getUsage.mockResolvedValue(usage);

			// When - getUsage를 호출하면
			const result = await controller.getUsage(mockUser);

			// Then - Facade에 userId를 전달하고 성공 응답을 반환해야 한다
			expect(mockAiFacade.getUsage).toHaveBeenCalledWith(mockUser.userId);
			expect(result).toEqual({
				success: true,
				data: { used: 3, limit: 5, resetsAt: "2026-02-22T15:00:00.000Z" },
			});
		});

		it("사용량이 0일 때도 정상적으로 반환해야 한다", async () => {
			// Given - 사용량이 없을 때
			const usage = AiUsage.of(0, 5, "2026-02-22T15:00:00.000Z");
			mockAiFacade.getUsage.mockResolvedValue(usage);

			// When - getUsage를 호출하면
			const result = await controller.getUsage(mockUser);

			// Then - used가 0인 결과를 반환해야 한다
			expect(result).toEqual({
				success: true,
				data: { used: 0, limit: 5, resetsAt: "2026-02-22T15:00:00.000Z" },
			});
		});
	});
});
