import type { Mocked } from "vitest";
import { vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";

import type { UserPreferenceRecord } from "../../../domain/records/settings/user-preference.record.js";
import { type StreakMilestoneNotifierPort } from "../../ports/settings/streak-milestone.notifier.port.js";
import { type TodoCompletionStatsReaderPort } from "../../ports/settings/todo-completion-stats.reader.port.js";
import { type UserPreferenceRepositoryPort } from "../../ports/settings/user-preference.repository.port.js";
import { OnTodoToggled } from "./on-todo-toggled.use-case.js";

const userId = "user-1";
const tz = "Asia/Seoul";

const makeRecord = (overrides: Partial<UserPreferenceRecord>): UserPreferenceRecord =>
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

describe("OnTodoToggled", () => {
  let useCase: OnTodoToggled;
  let repo: Mocked<UserPreferenceRepositoryPort>;
  let statsReader: Mocked<TodoCompletionStatsReaderPort>;
  let notifier: Mocked<StreakMilestoneNotifierPort>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-16T09:00:00Z"));

    const onTodoToggledDependencies = mockDeep<ConstructorParameters<typeof OnTodoToggled>[0]>({});
    const unit = new OnTodoToggled(onTodoToggledDependencies);
    useCase = unit;
    repo = onTodoToggledDependencies.preferenceRepository;
    statsReader = onTodoToggledDependencies.statsReader;
    notifier = onTodoToggledDependencies.milestoneNotifier;
  });

  afterEach(() => {
    vi.useRealTimers();
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
