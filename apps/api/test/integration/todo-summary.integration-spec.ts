/**
 * GetTodoSummaryUseCase 통합 테스트 (Mock DB)
 *
 * @description
 * 오늘의 할 일 요약 use-case가 실제 NestJS DI 컨테이너에서
 * StreakAdapter(StreakPort 구현) → UserSettingsFacade 위임 체인과 함께
 * 올바르게 조립·작동하는지 검증합니다. DB는 포트 수준에서 모킹합니다.
 *
 * 통합 테스트의 목적:
 * - 신규 쿼리 use-case의 NestJS 의존성 주입 정합성 검증
 * - StreakPort.getCurrentStreak → UserSettingsFacade.getPreferenceRecord 위임 검증
 * - 요약 합성(진행률/스트릭/상위 할 일) 통합 동작 검증
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test todo-summary.integration-spec
 * ```
 */

import { Test, type TestingModule } from "@nestjs/testing";
import { createTodoReadRepositoryMock } from "@test/mocks/ports";
import { suppressLogger } from "@test/setup/suppress-logger";
import { STREAK_PORT } from "@/todo/application/ports/streak.port";
import { TODO_READ_REPOSITORY } from "@/todo/application/ports/todo-read.repository.port";
import { GetTodoSummaryUseCase } from "@/todo/application/queries/get-todo-summary/get-todo-summary.use-case";
import { StreakAdapter } from "@/todo/infrastructure/adapters/streak.adapter";
import { UserSettingsFacade } from "@/user-settings";

describe("GetTodoSummaryUseCase 통합 테스트 (Mock DB)", () => {
	let module: TestingModule;
	let useCase: GetTodoSummaryUseCase;

	const mockReadRepository = createTodoReadRepositoryMock();

	// Mock UserSettingsFacade — StreakAdapter가 위임하는 실제 파사드 자리
	const mockUserSettingsFacade = {
		getPreferenceRecord: jest.fn(),
	};

	const today = new Date("2026-07-12T00:00:00.000Z");

	beforeAll(async () => {
		suppressLogger();

		module = await Test.createTestingModule({
			providers: [
				GetTodoSummaryUseCase,
				{ provide: TODO_READ_REPOSITORY, useValue: mockReadRepository },
				{ provide: STREAK_PORT, useClass: StreakAdapter },
				{ provide: UserSettingsFacade, useValue: mockUserSettingsFacade },
			],
		}).compile();

		useCase = module.get(GetTodoSummaryUseCase);
	});

	afterAll(async () => {
		await module.close();
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("실제 DI 체인(use-case → StreakAdapter → UserSettingsFacade)으로 요약을 합성한다", async () => {
		// Given
		jest.mocked(mockReadRepository.getTodayTodoStats).mockResolvedValue({
			total: 2,
			completed: 2,
		});
		jest.mocked(mockReadRepository.findManyByUserId).mockResolvedValue([]);
		// lastCompletedDate = 오늘: 스트릭 쓰기가 이미 착지한 상태 → 저장값 그대로
		mockUserSettingsFacade.getPreferenceRecord.mockResolvedValue({
			currentStreak: 7,
			lastCompletedDate: today,
		});

		// When
		const result = await useCase.execute({ userId: "user-123", today });

		// Then
		expect(result.date).toBe("2026-07-12");
		expect(result.isComplete).toBe(true);
		expect(result.completionRate).toBe(100);
		expect(result.currentStreak).toBe(7);
		expect(mockUserSettingsFacade.getPreferenceRecord).toHaveBeenCalledWith(
			"user-123",
		);
	});

	it("선호 레코드가 없는 사용자는 스트릭 0으로 응답한다", async () => {
		// Given
		jest.mocked(mockReadRepository.getTodayTodoStats).mockResolvedValue({
			total: 0,
			completed: 0,
		});
		jest.mocked(mockReadRepository.findManyByUserId).mockResolvedValue([]);
		mockUserSettingsFacade.getPreferenceRecord.mockResolvedValue(null);

		// When
		const result = await useCase.execute({ userId: "user-없음", today });

		// Then
		expect(result.currentStreak).toBe(0);
	});
});
