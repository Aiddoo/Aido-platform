import type { Todo as TodoResponse } from "@aido/api";
import { mock } from "vitest-mock-extended";

import { PaginationService } from "#api/shared/application/pagination/index";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { TodoBuilder } from "#test/builders/index";
import type { PlanningTodoRecord } from "#test/fixtures/todo-response.fixture";
import {
  StubPlanningTodoRepository,
  StubPlanningTodoReadRepository,
  StubPlanningTodoCache,
  StubPlanningEventPublisher,
  StubPlanningMutationLock,
  createCategoryOwnershipStub,
} from "#test/mocks/ports/planning-todo.stub";
import { createUnitOfWorkMock } from "#test/mocks/ports/unit-of-work.mock";

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
  for (const record of records.values())
    if (record.category !== null) {
      categories.set(record.categoryId, structuredClone(record.category));
      categoryOwners.set(record.categoryId, record.userId);
    }
  const todoRepository = new StubPlanningTodoRepository(records);
  const todoReadRepository = new StubPlanningTodoReadRepository(records, categories);
  const todoCache = new StubPlanningTodoCache();
  const eventPublisher = new StubPlanningEventPublisher();
  const mutationLock = new StubPlanningMutationLock();
  const categoryOwnership = createCategoryOwnershipStub(categories, categoryOwners);
  const unitOfWork = createUnitOfWorkMock();
  const logger = mock<ApplicationLogger>();
  const paginationService = new PaginationService();
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
    todoRepository,
    todoReadRepository,
    todoCache,
    eventPublisher,
    mutationLock,
    categoryOwnership,
    unitOfWork,
    logger,
    paginationService,
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
