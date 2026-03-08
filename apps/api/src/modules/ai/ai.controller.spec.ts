import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { CurrentUserPayload } from "@/modules/auth/decorators";

import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import type { ParseTodoRequestDto } from "./dtos";

describe("AiController", () => {
	let controller: AiController;
	let mockAiService: Mocked<AiService>;

	const mockUser: CurrentUserPayload = {
		userId: "user-123",
		email: "test@example.com",
		sessionId: "session-123",
		role: "USER",
	};

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(AiController).compile();

		controller = unit;
		mockAiService = unitRef.get(AiService);
	});

	describe("parseTodo", () => {
		it("자연어 텍스트를 서비스에 위임하고 파싱 결과를 반환해야 한다", async () => {
			// Given -자연어 텍스트와 서비스 응답이 준비되었을 때
			const dto = { text: "내일 오후 3시에 팀 미팅" };
			const serviceResult = {
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
					model: "google:gemini-2.0-flash",
					processingTimeMs: 185,
					tokenUsage: { input: 180, output: 45 },
				},
			};
			mockAiService.parseTodo.mockResolvedValue(serviceResult);

			// When -parseTodo를 호출하면
			const result = await controller.parseTodo(
				mockUser,
				dto as unknown as ParseTodoRequestDto,
				"Asia/Seoul",
			);

			// Then -서비스에 text, userId, timezone, categoryId를 전달하고 성공 응답을 반환해야 한다
			expect(mockAiService.parseTodo).toHaveBeenCalledWith(
				dto.text,
				mockUser.userId,
				"Asia/Seoul",
				undefined,
			);
			expect(result).toEqual({
				success: true,
				data: serviceResult.data,
				meta: serviceResult.meta,
			});
		});

		it("categoryId가 포함된 요청을 서비스에 전달해야 한다", async () => {
			// Given -categoryId가 포함된 요청
			const dto = { text: "내일 오후 3시에 팀 미팅", categoryId: 42 };
			const serviceResult = {
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
					model: "google:gemini-2.0-flash",
					processingTimeMs: 185,
					tokenUsage: { input: 180, output: 45 },
				},
			};
			mockAiService.parseTodo.mockResolvedValue(serviceResult);

			// When -parseTodo를 호출하면
			const result = await controller.parseTodo(
				mockUser,
				dto as unknown as ParseTodoRequestDto,
				"Asia/Seoul",
			);

			// Then -categoryId가 서비스에 전달되고 응답에 포함되어야 한다
			expect(mockAiService.parseTodo).toHaveBeenCalledWith(
				dto.text,
				mockUser.userId,
				"Asia/Seoul",
				42,
			);
			expect(result.data.categoryId).toBe(42);
		});
	});

	describe("getUsage", () => {
		it("AI 사용량을 서비스에서 조회하고 결과를 반환해야 한다", async () => {
			// Given -사용량 조회 서비스 응답이 준비되었을 때
			const usageResult = {
				used: 3,
				limit: 5,
				resetsAt: "2026-02-22T15:00:00.000Z",
			};
			mockAiService.getUsage.mockResolvedValue(usageResult);

			// When -getUsage를 호출하면
			const result = await controller.getUsage(mockUser);

			// Then -서비스에 userId를 전달하고 성공 응답을 반환해야 한다
			expect(mockAiService.getUsage).toHaveBeenCalledWith(mockUser.userId);
			expect(result).toEqual({
				success: true,
				data: usageResult,
			});
		});

		it("사용량이 0일 때도 정상적으로 반환해야 한다", async () => {
			// Given -사용량이 없을 때
			const usageResult = {
				used: 0,
				limit: 5,
				resetsAt: "2026-02-22T15:00:00.000Z",
			};
			mockAiService.getUsage.mockResolvedValue(usageResult);

			// When -getUsage를 호출하면
			const result = await controller.getUsage(mockUser);

			// Then -used가 0인 결과를 반환해야 한다
			expect(result).toEqual({
				success: true,
				data: usageResult,
			});
		});
	});
});
