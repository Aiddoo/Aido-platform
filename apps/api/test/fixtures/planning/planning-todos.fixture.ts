import type { Todo as TodoResponse } from "@aido/api";

import { MaterializeTodoOccurrencesUseCase } from "#api/modules/planning/todo-series/application/use-cases/materialize-todo-occurrences.use-case";
import { PublishTodoSeriesEditUseCase } from "#api/modules/planning/todo-series/application/use-cases/publish-todo-series-edit.use-case";
import type { TodoSeries } from "#api/modules/planning/todo-series/domain/todo-series.aggregate";
import { ApplyTodoEventsUseCase } from "#api/modules/planning/todos/application/use-cases/apply-todo-events.use-case";
import { ResolveTodoTimezoneUseCase } from "#api/modules/planning/todos/application/use-cases/resolve-todo-timezone.use-case";
import { PaginationService } from "#api/shared/application/pagination/index";
import { TodoBuilder } from "#test/builders/index";
import { FakeTodoCache } from "#test/doubles/planning/fake-todo-cache";
import { InMemoryTodoReadRepository } from "#test/doubles/planning/in-memory-todo-read.repository";
import { InMemoryTodoSeriesRepository } from "#test/doubles/planning/in-memory-todo-series.repository";
import { InMemoryTodoRepository } from "#test/doubles/planning/in-memory-todo.repository";
import { RecordingDomainEventPublisher } from "#test/doubles/planning/recording-domain-event-publisher";
import { RecordingTodoCompletionEffects } from "#test/doubles/planning/recording-todo-completion-effects";
import { RecordingTodoReminderScheduler } from "#test/doubles/planning/recording-todo-reminder-scheduler";
import { createStubCategoryOwnership } from "#test/doubles/planning/stub-category-ownership";
import { StubTodoOwnerTimezone } from "#test/doubles/planning/stub-todo-owner-timezone";
import { StubTodoSeriesOwner } from "#test/doubles/planning/stub-todo-series-owner";
import { DateClock } from "#test/doubles/platform/date-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import type { PlanningTodoRecord } from "#test/fixtures/todo-response.fixture";

export const PLANNING_TIME = new Date("2026-05-15T03:00:00.000Z");

export function createPlanningTodoFixture(
  input: { userId?: string; todos?: PlanningTodoRecord[] } = {},
) {
  const userId = input.userId ?? "planning-user";
  const records = new Map(
    (input.todos ?? []).map((record) => [record.id, structuredClone(record)]),
  );
  const categories = new Map<number, TodoResponse["category"]>([
    [1, { id: 1, name: "기본 카테고리", color: "#FFB3B3", sortOrder: 0 }],
  ]);
  const categoryOwners = new Map<number, string>([[1, userId]]);
  for (const record of records.values()) {
    if (record.category !== null) {
      categories.set(record.categoryId, structuredClone(record.category));
      categoryOwners.set(record.categoryId, record.userId);
    }
  }
  const todoCache = new FakeTodoCache();
  const eventPublisher = new RecordingDomainEventPublisher();
  const logger = new SilentLogger();
  const seriesStore = new Map<string, TodoSeries>();
  const todoRepository = new InMemoryTodoRepository(records, seriesStore);
  const todoReadRepository = new InMemoryTodoReadRepository(records, categories, seriesStore);
  const todoSeriesRepository = new InMemoryTodoSeriesRepository(seriesStore);
  const seriesOwner = new StubTodoSeriesOwner();
  const todoReminder = new RecordingTodoReminderScheduler();
  const clock = new DateClock();
  const applyTodoEvents = new ApplyTodoEventsUseCase({
    reminderScheduler: todoReminder,
    eventPublisher,
    clock,
  });
  const occurrenceMaterializer = new MaterializeTodoOccurrencesUseCase({
    todoRepository,
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
  const paginationService = new PaginationService();
  const seriesCatchUp = { execute: async (_userId: string) => undefined };
  const friendIds = new Set<string>();
  const friendPort = {
    async isMutualFriend(_userId: string, friendUserId: string) {
      return friendIds.has(friendUserId);
    },
  };
  const streakContext: { currentStreak: number; lastCompletedDate: Date | null } = {
    currentStreak: 0,
    lastCompletedDate: null,
  };
  const streakPort = {
    async getStreakContext(_userId: string) {
      return structuredClone(streakContext);
    },
  };
  return {
    userId,
    records,
    categories,
    categoryOwners,
    seriesStore,
    todoRepository,
    todoReadRepository,
    todoSeriesRepository,
    todoReminder,
    applyTodoEvents,
    clock,
    seriesRepository: todoSeriesRepository,
    seriesOwner,
    seriesEffects,
    occurrenceMaterializer,
    todoCache,
    eventPublisher,
    completionEffects,
    mutationLock,
    categoryOwnership,
    unitOfWork,
    ownerTimezone,
    timezoneResolver,
    logger,
    paginationService,
    seriesCatchUp,
    friendIds,
    friendPort,
    streakContext,
    streakPort,
  };
}

export function createPlanningTodo(userId = "planning-user", id = 1) {
  return TodoBuilder.create(userId)
    .withId(id)
    .withStartDate(new Date("2026-05-15T00:00:00.000Z"))
    .build();
}
