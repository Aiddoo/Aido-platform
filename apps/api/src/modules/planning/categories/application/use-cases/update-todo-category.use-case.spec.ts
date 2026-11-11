import { ErrorCode } from "@aido/api/errors";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FakeTodoCache } from "#test/doubles/planning/fake-todo-cache";
import { FakeTodoCategoryCache } from "#test/doubles/planning/fake-todo-category-cache";
import { InMemoryTodoCategoryRepository } from "#test/doubles/planning/in-memory-todo-category.repository";
import { RecordingDomainEventPublisher } from "#test/doubles/planning/recording-domain-event-publisher";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingAfterCommitRegistry } from "#test/doubles/platform/recording-after-commit-registry";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createTodoCategoryFixture } from "#test/fixtures/planning/todo-category.fixture";
import { TODO_FIXTURE_NOW, TODO_FIXTURE_USER_ID } from "#test/fixtures/planning/todo.fixture";

import type { TodoCategoryId } from "../../domain/todo-category-id.vo.js";
import type { UpdateCategoryInput } from "../ports/todo-category.repository.port.js";
import { UpdateTodoCategoryUseCase } from "./update-todo-category.use-case.js";

const USER_ID = TODO_FIXTURE_USER_ID;
const LATER = TODO_FIXTURE_NOW.add({ hours: 1 });

class RecordingCategoryRepository extends InMemoryTodoCategoryRepository {
  readonly updates: [number, UpdateCategoryInput][] = [];
  readonly nameChecks: string[] = [];

  override async existsByUserIdAndName(
    userId: UserId,
    name: string,
    excludeId?: TodoCategoryId,
  ): Promise<boolean> {
    this.nameChecks.push(name);
    return super.existsByUserIdAndName(userId, name, excludeId);
  }

  override async update(id: TodoCategoryId, input: UpdateCategoryInput) {
    this.updates.push([id.value, input]);
    return super.update(id, input);
  }
}

function setUp(unitOfWork: ImmediateUnitOfWork = new ImmediateUnitOfWork()) {
  const repository = new RecordingCategoryRepository([
    createTodoCategoryFixture({ id: 1, name: "기존", color: "#FFB3B3" }),
    createTodoCategoryFixture({ id: 2, name: "개인", sortOrder: 1 }),
  ]);
  const cache = new FakeTodoCategoryCache();
  const todoCache = new FakeTodoCache();
  const afterCommit = new RecordingAfterCommitRegistry();
  const eventPublisher = new RecordingDomainEventPublisher();
  const useCase = new UpdateTodoCategoryUseCase({
    repository,
    cache,
    todoCache,
    afterCommit,
    mutationLock: new RecordingMutationLock(),
    unitOfWork,
    clock: new FixedClock(LATER),
    eventPublisher,
    logger: new SilentLogger(),
  });
  return { repository, cache, todoCache, afterCommit, eventPublisher, useCase };
}

describe("카테고리 수정", () => {
  it.each([
    {
      name: "남의 카테고리나 없는 카테고리면 TODO_CATEGORY_0851",
      command: { id: 9, data: { name: "수정" } },
      error: { errorCode: ErrorCode.TODO_CATEGORY_0851, details: { categoryId: 9 } },
    },
    {
      name: "이름이 다른 카테고리와 겹치면 TODO_CATEGORY_0853",
      command: { id: 1, data: { name: "개인" } },
      error: { errorCode: ErrorCode.TODO_CATEGORY_0853, details: { name: "개인" } },
    },
  ])("$name이고 저장·캐시·이벤트가 없다", async ({ command, error }) => {
    // Given
    const { repository, cache, eventPublisher, useCase } = setUp();

    // When
    const update = useCase.execute({ userId: USER_ID, ...command });

    // Then
    await expect(update).rejects.toMatchObject(error);
    expect(repository.updates).toEqual([]);
    expect(cache.invalidatedUserIds).toEqual([]);
    expect(eventPublisher.publishedEvents).toEqual([]);
  });

  it("수정한 이름과 색상을 저장하고 이벤트는 트랜잭션 안에서, 캐시 무효화는 커밋 뒤에 한다", async () => {
    // Given
    const insideCommit: { invalidated: number; events: number }[] = [];
    let cache: FakeTodoCategoryCache | null = null;
    let eventPublisher: RecordingDomainEventPublisher | null = null;
    class ObservedUnitOfWork extends ImmediateUnitOfWork {
      override async run<T>(work: () => Promise<T>): Promise<T> {
        const result = await work();
        insideCommit.push({
          invalidated: cache?.invalidatedUserIds.length ?? 0,
          events: eventPublisher?.publishedEvents.length ?? 0,
        });
        return result;
      }
    }
    const context = setUp(new ObservedUnitOfWork());
    cache = context.cache;
    eventPublisher = context.eventPublisher;

    // When
    const result = await context.useCase.execute({
      id: 1,
      userId: USER_ID,
      data: { name: "수정", color: "#FF0000" },
    });

    // Then
    expect(insideCommit).toEqual([{ invalidated: 0, events: 1 }]);
    expect(result.toPrimitives()).toMatchObject({ name: "수정", color: "#FF0000", sortOrder: 0 });
    expect(context.repository.updates).toEqual([[1, { name: "수정", color: "#FF0000" }]]);
    expect(context.cache.invalidatedUserIds).toEqual([USER_ID]);
    expect(
      context.eventPublisher.publishedEvents.map((event) => [event.eventName, event.toPayload()]),
    ).toEqual([
      [
        "planning.todo-category.updated",
        { categoryId: 1, userId: USER_ID, occurredAt: "2026-11-10T01:00:00.000Z" },
      ],
    ]);
  });

  it("이름이 기존과 같으면 중복 검사를 건너뛴다", async () => {
    // Given
    const { repository, useCase } = setUp();

    // When
    await useCase.execute({ id: 1, userId: USER_ID, data: { name: "기존", color: "#FF0000" } });

    // Then
    expect(repository.nameChecks).toEqual([]);
    expect(repository.updates).toEqual([[1, { name: "기존", color: "#FF0000" }]]);
  });

  it("이름을 바꾸면 친구 화면 할 일 캐시를 커밋 뒤에 지운다", async () => {
    // Given
    const { todoCache, afterCommit, useCase } = setUp();

    // When
    await useCase.execute({ id: 1, userId: USER_ID, data: { name: "수정" } });
    const beforeCommit = todoCache.generations.get(USER_ID);
    await afterCommit.runAll();

    // Then
    expect(beforeCommit).toBeUndefined();
    expect(todoCache.generations.get(USER_ID)).toBe(1);
  });

  it("같은 이름·색상이면 저장·이벤트 없이 그대로 돌려준다", async () => {
    // Given
    const { repository, eventPublisher, afterCommit, useCase } = setUp();

    // When
    const result = await useCase.execute({
      id: 1,
      userId: USER_ID,
      data: { name: "기존", color: "#FFB3B3" },
    });

    // Then
    expect(result.toPrimitives()).toMatchObject({ name: "기존", updatedAt: TODO_FIXTURE_NOW });
    expect(repository.updates).toEqual([]);
    expect(eventPublisher.publishedEvents).toEqual([]);
    expect(afterCommit.tasks).toEqual([]);
  });
});
