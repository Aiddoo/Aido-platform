/**
 * GetTodoSummaryUseCase 단위 테스트
 *
 * - 오늘 통계 + 상위 할 일 + 스트릭을 병렬 조회해 요약으로 합성
 * - 완료율/완료일 규칙은 도메인 정책(summarizeCompletion)과 동일해야 한다
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import {
	createStreakMock,
	createTodoReadRepositoryMock,
} from "@test/mocks/ports";
import { STREAK_PORT, type StreakPort } from "../../ports/streak.port";
import {
	TODO_READ_REPOSITORY,
	type TodaySummaryTodoRow,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";
import { GetTodoSummaryUseCase } from "./get-todo-summary.use-case";

function buildRow(
	id: number,
	completed: boolean,
	title = `할 일 ${id}`,
): TodaySummaryTodoRow {
	return { id, title, completed, categoryColor: "#FFB3B3" };
}

describe("GetTodoSummaryUseCase — 오늘의 할 일 요약 조회 (홈 위젯용)", () => {
	let useCase: GetTodoSummaryUseCase;
	let todoReadRepository: Mocked<TodoReadRepositoryPort>;
	let streakPort: Mocked<StreakPort>;

	const today = new Date("2026-07-12T00:00:00.000Z");
	const baseInput = { userId: "user-123", today };

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(GetTodoSummaryUseCase)
			.mock<TodoReadRepositoryPort>(TODO_READ_REPOSITORY)
			.impl(() => createTodoReadRepositoryMock())
			.mock<StreakPort>(STREAK_PORT)
			.impl(() => createStreakMock())
			.compile();

		useCase = unit;
		todoReadRepository =
			unitRef.get<TodoReadRepositoryPort>(TODO_READ_REPOSITORY);
		streakPort = unitRef.get<StreakPort>(STREAK_PORT);
	});

	it("오늘 통계·상위 할 일·스트릭을 합성해 요약을 반환한다", async () => {
		// Given
		todoReadRepository.getTodayTodoStats.mockResolvedValue({
			total: 5,
			completed: 3,
		});
		todoReadRepository.findTodayTopTodos.mockResolvedValue([
			buildRow(2, false),
			buildRow(1, true),
		]);
		streakPort.getCurrentStreak.mockResolvedValue(12);

		// When
		const result = await useCase.execute(baseInput);

		// Then
		expect(result).toEqual({
			date: "2026-07-12",
			totalTodos: 5,
			completedTodos: 3,
			completionRate: 60,
			isComplete: false,
			currentStreak: 12,
			// 저장소가 내려준 순서(미완료 우선)를 그대로 보존한다
			topTodos: [
				{
					id: 2,
					title: expect.any(String),
					completed: false,
					categoryColor: "#FFB3B3",
				},
				{
					id: 1,
					title: expect.any(String),
					completed: true,
					categoryColor: "#FFB3B3",
				},
			],
		});
	});

	it("상위 할 일은 위젯 전용 쿼리로 오늘 날짜 기준 최대 10개만 조회한다", async () => {
		// Given
		todoReadRepository.getTodayTodoStats.mockResolvedValue({
			total: 0,
			completed: 0,
		});
		todoReadRepository.findTodayTopTodos.mockResolvedValue([]);
		streakPort.getCurrentStreak.mockResolvedValue(0);

		// When
		await useCase.execute(baseInput);

		// Then - 정렬(미완료 우선)은 저장소 쿼리가 소유한다
		expect(todoReadRepository.findTodayTopTodos).toHaveBeenCalledWith(
			"user-123",
			today,
			10,
		);
	});

	it("할 일이 없는 날은 완료율 0, isComplete false다 (total=0 엣지)", async () => {
		// Given
		todoReadRepository.getTodayTodoStats.mockResolvedValue({
			total: 0,
			completed: 0,
		});
		todoReadRepository.findTodayTopTodos.mockResolvedValue([]);
		streakPort.getCurrentStreak.mockResolvedValue(3);

		// When
		const result = await useCase.execute(baseInput);

		// Then
		expect(result.totalTodos).toBe(0);
		expect(result.completionRate).toBe(0);
		expect(result.isComplete).toBe(false);
		expect(result.topTodos).toEqual([]);
	});

	it("전부 완료한 날은 완료율 100, isComplete true다", async () => {
		// Given
		todoReadRepository.getTodayTodoStats.mockResolvedValue({
			total: 4,
			completed: 4,
		});
		todoReadRepository.findTodayTopTodos.mockResolvedValue([]);
		streakPort.getCurrentStreak.mockResolvedValue(1);

		// When
		const result = await useCase.execute(baseInput);

		// Then
		expect(result.completionRate).toBe(100);
		expect(result.isComplete).toBe(true);
	});

	it("완료율은 daily-completion 규칙대로 반올림한다 (1/3 → 33)", async () => {
		// Given
		todoReadRepository.getTodayTodoStats.mockResolvedValue({
			total: 3,
			completed: 1,
		});
		todoReadRepository.findTodayTopTodos.mockResolvedValue([]);
		streakPort.getCurrentStreak.mockResolvedValue(0);

		// When
		const result = await useCase.execute(baseInput);

		// Then
		expect(result.completionRate).toBe(33);
	});
});
