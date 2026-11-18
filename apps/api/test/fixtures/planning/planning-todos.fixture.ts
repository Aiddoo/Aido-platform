import type { Todo as TodoResponse } from "@aido/api/contracts/todo/v1";

import { ApplyFollowingTodosUpdateUseCase } from "#api/modules/planning/todo-series/application/use-cases/apply-following-todos-update.use-case";
import { DeleteTodoOccurrencesUseCase } from "#api/modules/planning/todo-series/application/use-cases/delete-todo-occurrences.use-case";
import { MaterializeTodoOccurrencesUseCase } from "#api/modules/planning/todo-series/application/use-cases/materialize-todo-occurrences.use-case";
import { PublishTodoSeriesEditUseCase } from "#api/modules/planning/todo-series/application/use-cases/publish-todo-series-edit.use-case";
import { RemapFollowingOccurrencesUseCase } from "#api/modules/planning/todo-series/application/use-cases/remap-following-occurrences.use-case";
import type { TodoSeries } from "#api/modules/planning/todo-series/domain/todo-series.aggregate";
import { ApplyTodoEventsUseCase } from "#api/modules/planning/todos/application/use-cases/apply-todo-events.use-case";
import { ResolveTodoTimezoneUseCase } from "#api/modules/planning/todos/application/use-cases/resolve-todo-timezone.use-case";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FakeTodoCache } from "#test/doubles/planning/fake-todo-cache";
import { InMemoryTodoOccurrenceWriter } from "#test/doubles/planning/in-memory-todo-occurrence-writer";
import { InMemoryTodoReadRepository } from "#test/doubles/planning/in-memory-todo-read.repository";
import { InMemoryTodoSeriesRepository } from "#test/doubles/planning/in-memory-todo-series.repository";
import {
  copyTodoRecord,
  InMemoryTodoRepository,
  InMemoryTodoSequence,
} from "#test/doubles/planning/in-memory-todo.repository";
import { RecordingDomainEventPublisher } from "#test/doubles/planning/recording-domain-event-publisher";
import { RecordingTodoCompletionEffects } from "#test/doubles/planning/recording-todo-completion-effects";
import { RecordingTodoReminderScheduler } from "#test/doubles/planning/recording-todo-reminder-scheduler";
import { createStubCategoryOwnership } from "#test/doubles/planning/stub-category-ownership";
import { StubTodoOwnerTimezone } from "#test/doubles/planning/stub-todo-owner-timezone";
import { StubTodoSeriesOwner } from "#test/doubles/planning/stub-todo-series-owner";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import type { PlanningTodoRecord } from "#test/fixtures/planning/todo-response.fixture";
import { createPlanningTodoRecordFixture } from "#test/fixtures/planning/todo-response.fixture";

export const PLANNING_TIME = new Date("2026-05-15T03:00:00.000Z");
export const PLANNING_INSTANT = Temporal.Instant.fromEpochMilliseconds(PLANNING_TIME.getTime());

// Temporal 값은 structuredClone되지 않아 비교용 기록을 이 함수로 복사한다
export function snapshotTodoRecord(
  record: PlanningTodoRecord | undefined,
): PlanningTodoRecord | undefined {
  return record == null ? undefined : copyTodoRecord(record);
}

export function createPlanningTodoFixture(
  input: { userId?: string; todos?: PlanningTodoRecord[]; now?: Temporal.Instant } = {},
) {
  const userId = input.userId ?? "planning-user";
  const records = new Map((input.todos ?? []).map((record) => [record.id, copyTodoRecord(record)]));
  const categories = new Map<number, TodoResponse["category"]>([
    [1, { id: 1, name: "기본 카테고리", color: "#FFB3B3", sortOrder: 0 }],
  ]);
  const categoryOwners = new Map<number, string>([[1, userId]]);
  for (const record of records.values()) {
    if (record.category !== null) {
      categories.set(record.categoryId, { ...record.category });
      categoryOwners.set(record.categoryId, record.userId);
    }
  }
  const todoCache = new FakeTodoCache();
  const eventPublisher = new RecordingDomainEventPublisher();
  const logger = new SilentLogger();
  const seriesStore = new Map<string, TodoSeries>();
  const sequence = new InMemoryTodoSequence();
  const todoRepository = new InMemoryTodoRepository(records, seriesStore, sequence);
  const occurrenceWriter = new InMemoryTodoOccurrenceWriter(records, sequence);
  const todoReadRepository = new InMemoryTodoReadRepository(records, categories, seriesStore);
  const todoSeriesRepository = new InMemoryTodoSeriesRepository(seriesStore);
  const seriesOwner = new StubTodoSeriesOwner();
  const todoReminder = new RecordingTodoReminderScheduler();
  const clock = new FixedClock(input.now ?? PLANNING_INSTANT);
  const applyTodoEvents = new ApplyTodoEventsUseCase({
    reminderScheduler: todoReminder,
    eventPublisher,
    clock,
  });
  const occurrenceMaterializer = new MaterializeTodoOccurrencesUseCase({
    todoRepository,
    occurrenceWriter,
    todoReminder,
    applyTodoEvents,
  });
  const seriesEffects = new PublishTodoSeriesEditUseCase({ todoCache, logger });
  const completionEffects = new RecordingTodoCompletionEffects();
  const mutationLock = new RecordingMutationLock();
  const categoryOwnership = createStubCategoryOwnership(categories, categoryOwners);
  const unitOfWork = new ImmediateUnitOfWork();
  const ownerTimezone = new StubTodoOwnerTimezone(new Map([[userId, "Asia/Seoul"]]));
  const timezoneResolver = new ResolveTodoTimezoneUseCase({ ownerTimezone });
  const seriesCatchUp = { execute: async (_userId: string) => undefined };
  const friendIds = new Set<string>();
  const friendPort = {
    async isMutualFriend(_userId: UserId, friendUserId: UserId) {
      return friendIds.has(friendUserId.value);
    },
  };
  const streakContext: { currentStreak: number; lastCompletedDate: Temporal.PlainDate | null } = {
    currentStreak: 0,
    lastCompletedDate: null,
  };
  const streakPort = {
    async getStreakContext(_userId: UserId) {
      return { ...streakContext };
    },
  };
  const deleteOccurrences = new DeleteTodoOccurrencesUseCase({
    todoRepository,
    occurrenceWriter,
    seriesRepository: todoSeriesRepository,
    todoReminder,
    applyTodoEvents,
    effects: seriesEffects,
    unitOfWork,
    mutationLock,
    logger,
  });
  const applyFollowingUpdate = new ApplyFollowingTodosUpdateUseCase({
    todoRepository,
    occurrenceWriter,
    remapOccurrences: new RemapFollowingOccurrencesUseCase({ occurrenceWriter, mutationLock }),
    seriesRepository: todoSeriesRepository,
    categoryOwnership,
    materializer: occurrenceMaterializer,
    todoReminder,
    mutationLock,
    clock,
    applyTodoEvents,
  });
  return {
    userId,
    records,
    categories,
    categoryOwners,
    seriesStore,
    todoRepository,
    occurrenceWriter,
    todoReadRepository,
    todoSeriesRepository,
    todoReminder,
    applyTodoEvents,
    clock,
    seriesRepository: todoSeriesRepository,
    seriesOwner,
    seriesEffects,
    occurrenceMaterializer,
    deleteOccurrences,
    applyFollowingUpdate,
    todoCache,
    eventPublisher,
    completionEffects,
    mutationLock,
    categoryOwnership,
    unitOfWork,
    ownerTimezone,
    timezoneResolver,
    logger,
    seriesCatchUp,
    friendIds,
    friendPort,
    streakContext,
    streakPort,
  };
}

export function createPlanningTodo(userId = "planning-user", id = 1) {
  return createPlanningTodoRecordFixture({
    userId,
    id,
    startDate: Temporal.PlainDate.from("2026-05-15"),
    createdAt: PLANNING_INSTANT,
    updatedAt: PLANNING_INSTANT,
  });
}
