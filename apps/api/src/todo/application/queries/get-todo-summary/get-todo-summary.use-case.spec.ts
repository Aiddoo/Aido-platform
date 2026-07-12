/**
 * GetTodoSummaryUseCase 단위 테스트
 *
 * - 오늘 통계 + 상위 할 일 + 스트릭을 병렬 조회해 요약으로 합성
 * - 완료율/완료일 규칙은 도메인 정책(summarizeCompletion)과 동일해야 한다
 */
import type { Todo as TodoResponse } from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { TodoBuilder } from "@test/builders";
import {
	createStreakMock,
	createTodoReadRepositoryMock,
} from "@test/mocks/ports";
import { TodoMapper } from "../../../infrastructure/persistence/todo-response.mapper";
import { STREAK_PORT, type StreakPort } from "../../ports/streak.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";
import { GetTodoSummaryUseCase } from "./get-todo-summary.use-case";

function buildResponse(id: number, completed: boolean): TodoResponse {
	const todo = TodoBuilder.create("user-123").withId(id).build();
	const response = TodoMapper.toResponse(todo);
	return { ...response, completed };
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
		todoReadRepository.findManyByUserId.mockResolvedValue([
			buildResponse(1, true),
			buildResponse(2, false),
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
			topTodos: [
				{
					id: 1,
					title: expect.any(String),
					completed: true,
					categoryColor: expect.any(String),
				},
				{
					id: 2,
					title: expect.any(String),
					completed: false,
					categoryColor: expect.any(String),
				},
			],
		});
	});

	it("상위 할 일은 오늘 날짜 범위로 최대 10개만 조회한다", async () => {
		// Given
		todoReadRepository.getTodayTodoStats.mockResolvedValue({
			total: 0,
			completed: 0,
		});
		todoReadRepository.findManyByUserId.mockResolvedValue([]);
		streakPort.getCurrentStreak.mockResolvedValue(0);

		// When
		await useCase.execute(baseInput);

		// Then
		expect(todoReadRepository.findManyByUserId).toHaveBeenCalledWith({
			userId: "user-123",
			size: 10,
			startDate: today,
			endDate: today,
		});
	});

	it("할 일이 없는 날은 완료율 0, isComplete false다 (total=0 엣지)", async () => {
		// Given
		todoReadRepository.getTodayTodoStats.mockResolvedValue({
			total: 0,
			completed: 0,
		});
		todoReadRepository.findManyByUserId.mockResolvedValue([]);
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
		todoReadRepository.findManyByUserId.mockResolvedValue([]);
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
		todoReadRepository.findManyByUserId.mockResolvedValue([]);
		streakPort.getCurrentStreak.mockResolvedValue(0);

		// When
		const result = await useCase.execute(baseInput);

		// Then
		expect(result.completionRate).toBe(33);
	});
});
