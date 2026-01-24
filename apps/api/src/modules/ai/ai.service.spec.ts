import { Test, type TestingModule } from "@nestjs/testing";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import { DatabaseService } from "@/database/database.service";
import { FakeAiProvider } from "../../../test/mocks/fake-ai.provider";
import { AiService } from "./ai.service";
import { AI_PROVIDER } from "./providers/ai.provider";

interface MockUser {
	id: string;
	aiUsageCount: number;
	aiUsageResetAt: Date;
}

interface AiUsageInfo {
	aiUsageCount: number;
	aiUsageResetAt: Date;
}

interface MockPrisma {
	user: {
		findUnique: jest.Mock<Promise<MockUser | AiUsageInfo | null>>;
		update: jest.Mock<Promise<MockUser>>;
	};
}

describe("AiService", () => {
	let service: AiService;
	let fakeAiProvider: FakeAiProvider;
	let mockPrisma: MockPrisma;

	const mockUser: MockUser = {
		id: "user-1",
		aiUsageCount: 0,
		aiUsageResetAt: new Date(),
	};

	beforeEach(async () => {
		fakeAiProvider = new FakeAiProvider();
		mockPrisma = {
			user: {
				findUnique: jest.fn(),
				update: jest.fn(),
			},
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AiService,
				{ provide: AI_PROVIDER, useValue: fakeAiProvider },
				{ provide: DatabaseService, useValue: mockPrisma },
			],
		}).compile();

		service = module.get<AiService>(AiService);
	});

	afterEach(() => {
		fakeAiProvider.clear();
		jest.clearAllMocks();
	});

	describe("parseTodo", () => {
		it("자연어를 구조화된 투두로 파싱한다", async () => {
			// Given
			fakeAiProvider.setResponse({
				title: "팀 미팅",
				startDate: "2025-01-26",
				scheduledTime: "15:00",
				isAllDay: false,
			});
			mockPrisma.user.findUnique.mockResolvedValue(mockUser);
			mockPrisma.user.update.mockResolvedValue(mockUser);

			// When
			const result = await service.parseTodo(
				"내일 오후 3시에 팀 미팅",
				"user-1",
			);

			// Then
			expect(result.data).toMatchObject({
				title: "팀 미팅",
				startDate: "2025-01-26",
				scheduledTime: "15:00",
				isAllDay: false,
			});
			expect(result.meta.model).toBe("fake:test-model");
			expect(result.meta.processingTimeMs).toBeGreaterThanOrEqual(0);
			expect(result.meta.tokenUsage).toEqual({ input: 150, output: 50 });
		});

		it("종일 일정을 올바르게 파싱한다", async () => {
			// Given
			fakeAiProvider.setResponse({
				title: "출장",
				startDate: "2025-01-27",
				endDate: "2025-01-31",
				scheduledTime: null,
				isAllDay: true,
			});
			mockPrisma.user.findUnique.mockResolvedValue(mockUser);
			mockPrisma.user.update.mockResolvedValue(mockUser);

			// When
			const result = await service.parseTodo("다음주 월~금 출장", "user-1");

			// Then
			expect(result.data.isAllDay).toBe(true);
			expect(result.data.endDate).toBe("2025-01-31");
			expect(result.data.scheduledTime).toBeNull();
		});

		it("사용량을 증가시킨다", async () => {
			// Given
			fakeAiProvider.setResponse({
				title: "테스트",
				startDate: "2025-01-26",
				isAllDay: true,
			});
			mockPrisma.user.findUnique.mockResolvedValue({
				...mockUser,
				aiUsageCount: 3,
			});
			mockPrisma.user.update.mockResolvedValue(mockUser);

			// When
			await service.parseTodo("테스트", "user-1");

			// Then
			expect(mockPrisma.user.update).toHaveBeenCalledWith({
				where: { id: "user-1" },
				data: { aiUsageCount: { increment: 1 } },
			});
		});

		it("날짜가 바뀌면 사용량을 리셋한다", async () => {
			// Given
			fakeAiProvider.setResponse({
				title: "테스트",
				startDate: "2025-01-26",
				isAllDay: true,
			});

			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 1);

			mockPrisma.user.findUnique.mockResolvedValue({
				...mockUser,
				aiUsageCount: 5,
				aiUsageResetAt: yesterday,
			});
			mockPrisma.user.update.mockResolvedValue(mockUser);

			// When
			await service.parseTodo("테스트", "user-1");

			// Then
			expect(mockPrisma.user.update).toHaveBeenCalledWith({
				where: { id: "user-1" },
				data: {
					aiUsageCount: 1,
					aiUsageResetAt: expect.any(Date),
				},
			});
		});

		it("AI Provider가 불가용하면 AI_0001 에러를 던진다", async () => {
			// Given
			fakeAiProvider.setAvailable(false);

			// When & Then
			await expect(service.parseTodo("테스트", "user-1")).rejects.toThrow(
				BusinessException,
			);
			await expect(service.parseTodo("테스트", "user-1")).rejects.toMatchObject(
				{
					errorCode: "AI_0001",
				},
			);
		});

		it("AI 파싱 실패시 AI_0002 에러를 던진다", async () => {
			// Given
			fakeAiProvider.setInvalidResponse(new Error("Parse error"));
			mockPrisma.user.findUnique.mockResolvedValue(mockUser);

			// When & Then
			await expect(service.parseTodo("테스트", "user-1")).rejects.toThrow(
				BusinessException,
			);
			await expect(service.parseTodo("테스트", "user-1")).rejects.toMatchObject(
				{
					errorCode: "AI_0002",
				},
			);
		});

		it("프롬프트가 올바르게 생성되어 전달된다", async () => {
			// Given
			fakeAiProvider.setResponse({
				title: "회의",
				startDate: "2025-01-26",
				isAllDay: true,
			});
			mockPrisma.user.findUnique.mockResolvedValue(mockUser);
			mockPrisma.user.update.mockResolvedValue(mockUser);

			// When
			await service.parseTodo("내일 회의", "user-1");

			// Then
			const prompt = fakeAiProvider.getLastPrompt();
			expect(prompt).toBeDefined();
			expect(prompt).toContain("내일 회의");
			expect(prompt).toContain("Korean Todo Parser");
		});

		it("사용자를 찾을 수 없으면 USER_0001 에러를 던진다", async () => {
			// Given
			fakeAiProvider.setResponse({
				title: "테스트",
				startDate: "2025-01-26",
				isAllDay: true,
			});
			mockPrisma.user.findUnique.mockResolvedValue(null);

			// When & Then
			await expect(service.parseTodo("테스트", "unknown-user")).rejects.toThrow(
				BusinessException,
			);
		});
	});

	describe("getUsage", () => {
		it("현재 사용량을 반환한다", async () => {
			// Given
			mockPrisma.user.findUnique.mockResolvedValue({
				aiUsageCount: 3,
				aiUsageResetAt: new Date(),
			});

			// When
			const result = await service.getUsage("user-1");

			// Then
			expect(result).toMatchObject({
				used: 3,
				limit: 5,
			});
			expect(result.resetsAt).toBeDefined();
			// ISO 8601 형식 확인
			expect(result.resetsAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
		});

		it("날짜가 바뀌면 0을 반환한다", async () => {
			// Given
			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 1);

			mockPrisma.user.findUnique.mockResolvedValue({
				aiUsageCount: 5,
				aiUsageResetAt: yesterday,
			});

			// When
			const result = await service.getUsage("user-1");

			// Then
			expect(result.used).toBe(0);
			expect(result.limit).toBe(5);
		});

		it("사용자를 찾을 수 없으면 에러를 던진다", async () => {
			// Given
			mockPrisma.user.findUnique.mockResolvedValue(null);

			// When & Then
			await expect(service.getUsage("unknown-user")).rejects.toThrow(
				BusinessException,
			);
		});
	});

	describe("checkUsageLimit", () => {
		it("한도 내면 true를 반환한다", async () => {
			// Given
			mockPrisma.user.findUnique.mockResolvedValue({
				aiUsageCount: 4,
				aiUsageResetAt: new Date(),
			});

			// When
			const result = await service.checkUsageLimit("user-1");

			// Then
			expect(result).toBe(true);
		});

		it("한도에 도달하면 false를 반환한다", async () => {
			// Given
			mockPrisma.user.findUnique.mockResolvedValue({
				aiUsageCount: 5,
				aiUsageResetAt: new Date(),
			});

			// When
			const result = await service.checkUsageLimit("user-1");

			// Then
			expect(result).toBe(false);
		});

		it("한도 초과면 false를 반환한다", async () => {
			// Given
			mockPrisma.user.findUnique.mockResolvedValue({
				aiUsageCount: 10,
				aiUsageResetAt: new Date(),
			});

			// When
			const result = await service.checkUsageLimit("user-1");

			// Then
			expect(result).toBe(false);
		});

		it("새 날짜면 리셋되어 true를 반환한다", async () => {
			// Given
			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 1);

			mockPrisma.user.findUnique.mockResolvedValue({
				aiUsageCount: 5,
				aiUsageResetAt: yesterday,
			});

			// When
			const result = await service.checkUsageLimit("user-1");

			// Then
			expect(result).toBe(true);
		});
	});

	describe("토큰 사용량 추적", () => {
		it("결과에 토큰 사용량이 포함된다", async () => {
			// Given
			fakeAiProvider.setTokenUsage({ input: 200, output: 80 });
			fakeAiProvider.setResponse({
				title: "테스트",
				startDate: "2025-01-26",
				isAllDay: true,
			});
			mockPrisma.user.findUnique.mockResolvedValue(mockUser);
			mockPrisma.user.update.mockResolvedValue(mockUser);

			// When
			const result = await service.parseTodo("테스트", "user-1");

			// Then
			expect(result.meta.tokenUsage).toEqual({
				input: 200,
				output: 80,
			});
		});
	});

	describe("연속 요청 처리", () => {
		it("여러 응답을 순차적으로 반환한다", async () => {
			// Given
			fakeAiProvider.setResponses([
				{ title: "첫번째", startDate: "2025-01-26", isAllDay: true },
				{ title: "두번째", startDate: "2025-01-27", isAllDay: true },
				{ title: "세번째", startDate: "2025-01-28", isAllDay: true },
			]);
			mockPrisma.user.findUnique.mockResolvedValue(mockUser);
			mockPrisma.user.update.mockResolvedValue(mockUser);

			// When
			const result1 = await service.parseTodo("첫번째", "user-1");
			const result2 = await service.parseTodo("두번째", "user-1");
			const result3 = await service.parseTodo("세번째", "user-1");

			// Then
			expect(result1.data.title).toBe("첫번째");
			expect(result2.data.title).toBe("두번째");
			expect(result3.data.title).toBe("세번째");
			expect(fakeAiProvider.getCallCount()).toBe(3);
		});
	});
});
