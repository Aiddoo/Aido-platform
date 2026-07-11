/**
 * OnTodoToggledUseCase 단위 테스트 (스트릭 갱신 오케스트레이션)
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import type { UserPreferenceRecord } from "../../../domain/records/user-preference.record";
import {
	STREAK_MILESTONE_NOTIFIER,
	type StreakMilestoneNotifierPort,
} from "../../ports/streak-milestone.notifier.port";
import {
	TODO_COMPLETION_STATS_READER,
	type TodoCompletionStatsReaderPort,
} from "../../ports/todo-completion-stats.reader.port";
import {
	USER_PREFERENCE_REPOSITORY,
	type UserPreferenceRepositoryPort,
} from "../../ports/user-preference.repository.port";
import { OnTodoToggledUseCase } from "./on-todo-toggled.use-case";

const userId = "user-1";
const tz = "Asia/Seoul";

const makeRecord = (
	overrides: Partial<UserPreferenceRecord>,
): UserPreferenceRecord =>
	({
		pushEnabled: true,
		nightPushEnabled: true,
		timezone: tz,
		locale: "ko",
		morningReminderHour: 8,
		morningReminderMinute: 0,
		eveningReminderHour: 18,
		eveningReminderMinute: 0,
		timeFormat: "TWELVE_HOUR",
		weatherMorningEnabled: true,
		weatherMorningHour: 7,
		weatherMorningMinute: 0,
		weatherEveningEnabled: true,
		weatherEveningHour: 17,
		weatherEveningMinute: 30,
		currentStreak: 0,
		longestStreak: 0,
		lastCompletedDate: null,
		...overrides,
	}) satisfies UserPreferenceRecord;

describe("OnTodoToggledUseCase", () => {
	let useCase: OnTodoToggledUseCase;
	let repo: Mocked<UserPreferenceRepositoryPort>;
	let statsReader: Mocked<TodoCompletionStatsReaderPort>;
	let notifier: Mocked<StreakMilestoneNotifierPort>;

	beforeEach(async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2024-01-16T09:00:00Z"));

		const { unit, unitRef } =
			await TestBed.solitary(OnTodoToggledUseCase).compile();
		useCase = unit;
		repo = unitRef.get(USER_PREFERENCE_REPOSITORY);
		statsReader = unitRef.get(TODO_COMPLETION_STATS_READER);
		notifier = unitRef.get(STREAK_MILESTONE_NOTIFIER);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("오늘 투두가 0개면 아무 것도 하지 않는다", async () => {
		statsReader.countForDay.mockResolvedValue({ total: 0, completed: 0 });

		await useCase.execute(userId, true, tz);

		expect(repo.findByUserId).not.toHaveBeenCalled();
		expect(repo.updateStreak).not.toHaveBeenCalled();
	});

	it("전체 완료 → 스트릭 갱신, 3일 도달 시 마일스톤 알림", async () => {
		statsReader.countForDay.mockResolvedValue({ total: 2, completed: 2 });
		repo.findByUserId.mockResolvedValue(
			makeRecord({
				currentStreak: 2,
				longestStreak: 2,
				lastCompletedDate: new Date("2024-01-15T00:00:00Z"),
			}),
		);

		await useCase.execute(userId, true, tz);

		expect(repo.updateStreak).toHaveBeenCalledWith(
			userId,
			expect.objectContaining({ currentStreak: 3 }),
		);
		expect(notifier.notifyStreak3Reached).toHaveBeenCalledWith(userId);
	});

	it("완료 취소 → 오늘 완료 반영이 없으면 갱신하지 않는다", async () => {
		statsReader.countForDay.mockResolvedValue({ total: 2, completed: 1 });
		repo.findByUserId.mockResolvedValue(
			makeRecord({
				currentStreak: 3,
				longestStreak: 5,
				lastCompletedDate: new Date("2024-01-15T00:00:00Z"),
			}),
		);

		await useCase.execute(userId, false, tz);

		expect(repo.updateStreak).not.toHaveBeenCalled();
	});

	it("예외가 발생해도 전파하지 않는다 (fire-and-forget)", async () => {
		statsReader.countForDay.mockRejectedValue(new Error("DB error"));

		await expect(useCase.execute(userId, true, tz)).resolves.not.toThrow();
	});
});
