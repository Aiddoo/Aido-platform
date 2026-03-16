/**
 * AiService 단위 테스트 (Suites + GWT 패턴)
 *
 * 자연어 투두 파싱, 일일 사용량 관리, 권한별 제한 검증
 *
 * - Suites: 자동 Mock 생성 (DatabaseService, EntitlementService)
 * - FakeAiProvider: AI_PROVIDER Symbol 토큰용 테스트 더블
 * - GWT: Given/When/Then 주석
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { EntitlementService } from "@/common/entitlement/entitlement.service";
import { BusinessException } from "@/common/exception/services/business-exception.service";
import { DatabaseService } from "@/database/database.service";
import { UserRepository } from "@/modules/auth/repositories/user.repository";
import { FakeAiProvider } from "../../../test/mocks/fake-ai.provider";
import { AiService } from "./ai.service";
import { AI_PROVIDER } from "./providers/ai.provider";

describe("AiService", () => {
	let service: AiService;
	let fakeAiProvider: FakeAiProvider;
	let database: Mocked<DatabaseService>;
	let entitlementService: Mocked<EntitlementService>;
	let userRepository: Mocked<UserRepository>;

	const mockUser = {
		id: "user-1",
		aiUsageCount: 0,
		aiUsageResetAt: new Date(),
	};

	beforeEach(async () => {
		fakeAiProvider = new FakeAiProvider();

		const { unit, unitRef } = await TestBed.solitary(AiService)
			.mock(AI_PROVIDER)
			.impl(() => fakeAiProvider)
			.compile();

		service = unit;
		database = unitRef.get(DatabaseService);
		entitlementService = unitRef.get(EntitlementService);
		userRepository = unitRef.get(UserRepository);

		// $transaction passthrough
		(database.$transaction as jest.Mock).mockImplementation(
			(callback: (tx: unknown) => unknown) => callback(database),
		);

		// 기본: FREE 사용자 (dailyLimit: 5)
		(entitlementService.getFeatureLimit as jest.Mock).mockResolvedValue({
			dailyLimit: 5,
			isAdmin: false,
			subscriptionStatus: "FREE",
		});

		// enforceLimit — 실제 로직 위임
		(entitlementService.enforceLimit as jest.Mock).mockImplementation(
			(entitlement, currentUsage, errorFactory) => {
				if (entitlement.dailyLimit === null) return;
				if (currentUsage < entitlement.dailyLimit) return;
				throw errorFactory(currentUsage, entitlement.dailyLimit);
			},
		);
	});

	afterEach(() => {
		fakeAiProvider.clear();
	});

	// =========================================================================
	// parseTodo
	// =========================================================================

	describe("parseTodo", () => {
		it("자연어를 구조화된 투두로 파싱한다", async () => {
			// Given
			fakeAiProvider.setResponse({
				title: "팀 미팅",
				startDate: "2025-01-26",
				scheduledTime: "15:00",
				isAllDay: false,
			});
			(userRepository.findAiUsage as jest.Mock).mockResolvedValue(mockUser);
			(userRepository.incrementAiUsage as jest.Mock).mockResolvedValue(
				undefined,
			);

			// When
			const result = await service.parseTodo(
				"내일 오후 3시에 팀 미팅",
				"user-1",
				"Asia/Seoul",
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
			(userRepository.findAiUsage as jest.Mock).mockResolvedValue(mockUser);
			(userRepository.incrementAiUsage as jest.Mock).mockResolvedValue(
				undefined,
			);

			// When
			const result = await service.parseTodo(
				"다음주 월~금 출장",
				"user-1",
				"Asia/Seoul",
			);

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
			(userRepository.findAiUsage as jest.Mock).mockResolvedValue({
				...mockUser,
				aiUsageCount: 3,
			});
			(userRepository.incrementAiUsage as jest.Mock).mockResolvedValue(
				undefined,
			);

			// When
			await service.parseTodo("테스트", "user-1", "Asia/Seoul");

			// Then
			expect(userRepository.incrementAiUsage).toHaveBeenCalled();
			expect(
				(userRepository.incrementAiUsage as jest.Mock).mock.calls[0][0],
			).toBe("user-1");
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

			(userRepository.findAiUsage as jest.Mock).mockResolvedValue({
				...mockUser,
				aiUsageCount: 5,
				aiUsageResetAt: yesterday,
			});
			(userRepository.resetAndIncrementAiUsage as jest.Mock).mockResolvedValue(
				undefined,
			);

			// When
			await service.parseTodo("테스트", "user-1", "Asia/Seoul");

			// Then
			expect(userRepository.resetAndIncrementAiUsage).toHaveBeenCalled();
			expect(
				(userRepository.resetAndIncrementAiUsage as jest.Mock).mock.calls[0][0],
			).toBe("user-1");
		});

		it("AI Provider가 불가용하면 AI_1301 에러를 던진다", async () => {
			// Given
			fakeAiProvider.setAvailable(false);

			// When & Then
			await expect(
				service.parseTodo("테스트", "user-1", "Asia/Seoul"),
			).rejects.toThrow(BusinessException);
			await expect(
				service.parseTodo("테스트", "user-1", "Asia/Seoul"),
			).rejects.toMatchObject({
				errorCode: "AI_1301",
			});
		});

		it("AI 파싱 실패시 AI_1302 에러를 던진다", async () => {
			// Given
			fakeAiProvider.setInvalidResponse(new Error("Parse error"));
			(userRepository.findAiUsage as jest.Mock).mockResolvedValue(mockUser);
			(userRepository.incrementAiUsage as jest.Mock).mockResolvedValue(
				undefined,
			);
			(userRepository.decrementAiUsage as jest.Mock).mockResolvedValue(
				undefined,
			);

			// When & Then
			await expect(
				service.parseTodo("테스트", "user-1", "Asia/Seoul"),
			).rejects.toThrow(BusinessException);
			await expect(
				service.parseTodo("테스트", "user-1", "Asia/Seoul"),
			).rejects.toMatchObject({
				errorCode: "AI_1302",
			});
		});

		it("프롬프트가 올바르게 생성되어 전달된다", async () => {
			// Given
			fakeAiProvider.setResponse({
				title: "회의",
				startDate: "2025-01-26",
				isAllDay: true,
			});
			(userRepository.findAiUsage as jest.Mock).mockResolvedValue(mockUser);
			(userRepository.incrementAiUsage as jest.Mock).mockResolvedValue(
				undefined,
			);

			// When
			await service.parseTodo("내일 회의", "user-1", "Asia/Seoul");

			// Then
			const prompt = fakeAiProvider.getLastPrompt();
			expect(prompt).toBeDefined();
			expect(prompt).toContain("내일 회의");
			expect(prompt).toContain("Korean Todo Parser");
		});

		it("categoryId가 전달되면 결과에 포함된다", async () => {
			// Given
			fakeAiProvider.setResponse({
				title: "팀 미팅",
				startDate: "2025-01-26",
				scheduledTime: "15:00",
				isAllDay: false,
			});
			(userRepository.findAiUsage as jest.Mock).mockResolvedValue(mockUser);
			(userRepository.incrementAiUsage as jest.Mock).mockResolvedValue(
				undefined,
			);

			// When
			const result = await service.parseTodo(
				"내일 오후 3시에 팀 미팅",
				"user-1",
				"Asia/Seoul",
				42,
			);

			// Then
			expect(result.data.categoryId).toBe(42);
		});

		it("categoryId가 없으면 결과에 포함되지 않는다", async () => {
			// Given
			fakeAiProvider.setResponse({
				title: "팀 미팅",
				startDate: "2025-01-26",
				scheduledTime: "15:00",
				isAllDay: false,
			});
			(userRepository.findAiUsage as jest.Mock).mockResolvedValue(mockUser);
			(userRepository.incrementAiUsage as jest.Mock).mockResolvedValue(
				undefined,
			);

			// When
			const result = await service.parseTodo(
				"내일 오후 3시에 팀 미팅",
				"user-1",
				"Asia/Seoul",
			);

			// Then
			expect(result.data).not.toHaveProperty("categoryId");
		});

		it("타임존이 프롬프트에 반영된다", async () => {
			// Given
			fakeAiProvider.setResponses([
				{ title: "회의", startDate: "2025-01-26", isAllDay: true },
				{ title: "회의", startDate: "2025-01-26", isAllDay: true },
			]);
			(userRepository.findAiUsage as jest.Mock).mockResolvedValue(mockUser);
			(userRepository.incrementAiUsage as jest.Mock).mockResolvedValue(
				undefined,
			);

			// When - 서로 다른 타임존으로 호출
			await service.parseTodo("회의", "user-1", "Asia/Seoul");
			const promptKST = fakeAiProvider.getLastPrompt();

			await service.parseTodo("회의", "user-1", "America/New_York");
			const promptNY = fakeAiProvider.getLastPrompt();

			// Then - 타임존에 따라 프롬프트의 시간이 다르다
			expect(promptKST).toContain("Korean Todo Parser");
			expect(promptNY).toContain("Korean Todo Parser");
			expect(promptKST).not.toBe(promptNY);
		});

		it("사용자를 찾을 수 없으면 USER_0001 에러를 던진다", async () => {
			// Given
			fakeAiProvider.setResponse({
				title: "테스트",
				startDate: "2025-01-26",
				isAllDay: true,
			});
			(userRepository.findAiUsage as jest.Mock).mockResolvedValue(null);

			// When & Then
			await expect(
				service.parseTodo("테스트", "unknown-user", "Asia/Seoul"),
			).rejects.toThrow(BusinessException);
		});

		it("일일 사용량 초과 시 AI_1303 에러를 던진다", async () => {
			// Given
			fakeAiProvider.setResponse({
				title: "테스트",
				startDate: "2025-01-26",
				isAllDay: true,
			});
			(userRepository.findAiUsage as jest.Mock).mockResolvedValue({
				aiUsageCount: 5,
				aiUsageResetAt: new Date(),
			});

			// When & Then
			await expect(
				service.parseTodo("테스트", "user-1", "Asia/Seoul"),
			).rejects.toThrow(BusinessException);
			await expect(
				service.parseTodo("테스트", "user-1", "Asia/Seoul"),
			).rejects.toMatchObject({
				errorCode: "AI_1303",
			});
		});

		it("사용량 초과 시 AI Provider를 호출하지 않는다", async () => {
			// Given
			fakeAiProvider.setResponse({
				title: "테스트",
				startDate: "2025-01-26",
				isAllDay: true,
			});
			(userRepository.findAiUsage as jest.Mock).mockResolvedValue({
				aiUsageCount: 5,
				aiUsageResetAt: new Date(),
			});

			// When
			await service.parseTodo("테스트", "user-1", "Asia/Seoul").catch(() => {});

			// Then
			expect(fakeAiProvider.getCallCount()).toBe(0);
		});

		it("ADMIN 사용자는 사용량 초과해도 파싱 가능하다", async () => {
			// Given
			(entitlementService.getFeatureLimit as jest.Mock).mockResolvedValue({
				dailyLimit: null,
				isAdmin: true,
				subscriptionStatus: "FREE",
			});
			fakeAiProvider.setResponse({
				title: "테스트",
				startDate: "2025-01-26",
				isAllDay: true,
			});
			(userRepository.findAiUsage as jest.Mock).mockResolvedValue({
				...mockUser,
				aiUsageCount: 100,
			});
			(userRepository.incrementAiUsage as jest.Mock).mockResolvedValue(
				undefined,
			);

			// When
			const result = await service.parseTodo("테스트", "user-1", "Asia/Seoul");

			// Then
			expect(result.data.title).toBe("테스트");
		});

		it("ACTIVE 구독자는 사용량 초과해도 파싱 가능하다", async () => {
			// Given
			(entitlementService.getFeatureLimit as jest.Mock).mockResolvedValue({
				dailyLimit: null,
				isAdmin: false,
				subscriptionStatus: "ACTIVE",
			});
			fakeAiProvider.setResponse({
				title: "테스트",
				startDate: "2025-01-26",
				isAllDay: true,
			});
			(userRepository.findAiUsage as jest.Mock).mockResolvedValue({
				...mockUser,
				aiUsageCount: 100,
			});
			(userRepository.incrementAiUsage as jest.Mock).mockResolvedValue(
				undefined,
			);

			// When
			const result = await service.parseTodo("테스트", "user-1", "Asia/Seoul");

			// Then
			expect(result.data.title).toBe("테스트");
		});
	});

	// =========================================================================
	// getUsage
	// =========================================================================

	describe("getUsage", () => {
		it("현재 사용량을 반환한다", async () => {
			// Given
			(database.user.findUnique as jest.Mock).mockResolvedValue({
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

			(database.user.findUnique as jest.Mock).mockResolvedValue({
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
			(database.user.findUnique as jest.Mock).mockResolvedValue(null);

			// When & Then
			await expect(service.getUsage("unknown-user")).rejects.toThrow(
				BusinessException,
			);
		});

		it("ADMIN 사용자는 limit이 null이다", async () => {
			// Given
			(entitlementService.getFeatureLimit as jest.Mock).mockResolvedValue({
				dailyLimit: null,
				isAdmin: true,
				subscriptionStatus: "FREE",
			});
			(database.user.findUnique as jest.Mock).mockResolvedValue({
				aiUsageCount: 3,
				aiUsageResetAt: new Date(),
			});

			// When
			const result = await service.getUsage("user-1");

			// Then
			expect(result).toMatchObject({
				used: 3,
				limit: null,
			});
		});

		it("ACTIVE 구독자는 limit이 null이다", async () => {
			// Given
			(entitlementService.getFeatureLimit as jest.Mock).mockResolvedValue({
				dailyLimit: null,
				isAdmin: false,
				subscriptionStatus: "ACTIVE",
			});
			(database.user.findUnique as jest.Mock).mockResolvedValue({
				aiUsageCount: 10,
				aiUsageResetAt: new Date(),
			});

			// When
			const result = await service.getUsage("user-1");

			// Then
			expect(result).toMatchObject({
				used: 10,
				limit: null,
			});
		});
	});

	// =========================================================================
	// 토큰 사용량 추적
	// =========================================================================

	describe("토큰 사용량 추적", () => {
		it("결과에 토큰 사용량이 포함된다", async () => {
			// Given
			fakeAiProvider.setTokenUsage({ input: 200, output: 80 });
			fakeAiProvider.setResponse({
				title: "테스트",
				startDate: "2025-01-26",
				isAllDay: true,
			});
			(userRepository.findAiUsage as jest.Mock).mockResolvedValue(mockUser);
			(userRepository.incrementAiUsage as jest.Mock).mockResolvedValue(
				undefined,
			);

			// When
			const result = await service.parseTodo("테스트", "user-1", "Asia/Seoul");

			// Then
			expect(result.meta.tokenUsage).toEqual({
				input: 200,
				output: 80,
			});
		});
	});

	// =========================================================================
	// 연속 요청 처리
	// =========================================================================

	describe("연속 요청 처리", () => {
		it("여러 응답을 순차적으로 반환한다", async () => {
			// Given
			fakeAiProvider.setResponses([
				{ title: "첫번째", startDate: "2025-01-26", isAllDay: true },
				{ title: "두번째", startDate: "2025-01-27", isAllDay: true },
				{ title: "세번째", startDate: "2025-01-28", isAllDay: true },
			]);
			(userRepository.findAiUsage as jest.Mock).mockResolvedValue(mockUser);
			(userRepository.incrementAiUsage as jest.Mock).mockResolvedValue(
				undefined,
			);

			// When
			const result1 = await service.parseTodo("첫번째", "user-1", "Asia/Seoul");
			const result2 = await service.parseTodo("두번째", "user-1", "Asia/Seoul");
			const result3 = await service.parseTodo("세번째", "user-1", "Asia/Seoul");

			// Then
			expect(result1.data.title).toBe("첫번째");
			expect(result2.data.title).toBe("두번째");
			expect(result3.data.title).toBe("세번째");
			expect(fakeAiProvider.getCallCount()).toBe(3);
		});
	});
});
