import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FakeTodoCategoryCache } from "#test/doubles/planning/fake-todo-category-cache";
import { InMemoryTodoCategoryRepository } from "#test/doubles/planning/in-memory-todo-category.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createTodoCategoryFixture } from "#test/fixtures/planning/todo-category.fixture";
import { TODO_FIXTURE_NOW, TODO_FIXTURE_USER_ID } from "#test/fixtures/planning/todo.fixture";

import type { TodoCategory } from "../../domain/todo-category.aggregate.js";
import {
  type TodoCategoryFeatureQuota,
  TodoCategoryLimitReaderPort,
} from "../ports/todo-category-limit.reader.port.js";
import { CreateTodoCategoryUseCase } from "./create-todo-category.use-case.js";

const USER_ID = TODO_FIXTURE_USER_ID;

class StubTodoCategoryLimitReader extends TodoCategoryLimitReaderPort {
  maxCount: number | null = null;
  quota: TodoCategoryFeatureQuota = {};
  readonly quotaReads: [string, number][] = [];

  async readLimit(): Promise<number | null> {
    return this.maxCount;
  }

  async readLimitInTx(): Promise<number | null> {
    return this.maxCount;
  }

  async readFeatureQuotaInTx(userId: UserId, count: number): Promise<TodoCategoryFeatureQuota> {
    this.quotaReads.push([userId.value, count]);
    return this.quota;
  }
}

function existingCategories(): TodoCategory[] {
  return [
    createTodoCategoryFixture({ id: 1, name: "업무", sortOrder: 0 }),
    createTodoCategoryFixture({ id: 2, name: "개인", sortOrder: 0 }),
  ];
}

function setUp(
  overrides: {
    readonly repository?: InMemoryTodoCategoryRepository;
    readonly limitReader?: StubTodoCategoryLimitReader;
    readonly cache?: FakeTodoCategoryCache;
    readonly mutationLock?: RecordingMutationLock;
    readonly unitOfWork?: ImmediateUnitOfWork;
  } = {},
) {
  const repository =
    overrides.repository ?? new InMemoryTodoCategoryRepository(existingCategories());
  const limitReader = overrides.limitReader ?? new StubTodoCategoryLimitReader();
  const cache = overrides.cache ?? new FakeTodoCategoryCache();
  const mutationLock = overrides.mutationLock ?? new RecordingMutationLock();
  const useCase = new CreateTodoCategoryUseCase({
    repository,
    cache,
    limitReader,
    mutationLock,
    unitOfWork: overrides.unitOfWork ?? new ImmediateUnitOfWork(),
    clock: new FixedClock(TODO_FIXTURE_NOW),
    logger: new SilentLogger(),
  });
  return { repository, limitReader, cache, mutationLock, useCase };
}

describe("카테고리 생성", () => {
  it("한도 초과면 차감 없음과 서버가 계산한 featureQuota를 담아 TODO_CATEGORY_0857로 거부한다", async () => {
    // Given
    const featureQuota = {
      feature: "TODO_CATEGORY",
      allowed: true,
      limit: 2,
      used: 2,
      remaining: 0,
      period: null,
      resetsAt: null,
      isFairUse: false,
      perUse: null,
    };
    const limitReader = new StubTodoCategoryLimitReader();
    limitReader.maxCount = 2;
    limitReader.quota = featureQuota;
    const { repository, cache, useCase } = setUp({ limitReader });

    // When
    const creation = useCase.execute({ userId: USER_ID, name: "새 카테고리", color: "#FFB3B3" });

    // Then
    await expect(creation).rejects.toMatchObject({
      errorCode: ErrorCode.TODO_CATEGORY_0857,
      details: { charged: false, featureQuota },
    });
    expect(limitReader.quotaReads).toEqual([[USER_ID, 2]]);
    expect(await repository.countByUserId(UserId.reconstitute(USER_ID))).toBe(2);
    expect(cache.invalidatedUserIds).toEqual([]);
  });

  it("중복 이름이면 TODO_CATEGORY_0853이고 저장하지 않는다", async () => {
    // Given
    const { repository, cache, useCase } = setUp();

    // When
    const creation = useCase.execute({ userId: USER_ID, name: "업무", color: "#FFB3B3" });

    // Then
    await expect(creation).rejects.toMatchObject({
      errorCode: ErrorCode.TODO_CATEGORY_0853,
      details: { name: "업무" },
    });
    expect(await repository.countByUserId(UserId.reconstitute(USER_ID))).toBe(2);
    expect(cache.invalidatedUserIds).toEqual([]);
  });

  it("새 카테고리를 맨 뒤 순번으로 저장하고 캐시를 무효화한다", async () => {
    // Given
    const { repository, cache, useCase } = setUp();

    // When
    const result = await useCase.execute({
      userId: USER_ID,
      name: "새 카테고리",
      color: "#FFB3B3",
    });

    // Then
    const saved = await repository.findByIdAndUserId(result.id, UserId.reconstitute(USER_ID));
    expect(saved?.toPrimitives()).toEqual({
      id: 3,
      userId: USER_ID,
      name: "새 카테고리",
      color: "#FFB3B3",
      sortOrder: 1,
      createdAt: TODO_FIXTURE_NOW,
      updatedAt: TODO_FIXTURE_NOW,
    });
    expect(cache.invalidatedUserIds).toEqual([USER_ID]);
  });

  it("사용자 카테고리 키를 UoW 안에서 모든 guarded read 전에 잠그고 UoW callback 성공 후 캐시를 무효화한다", async () => {
    // Given - UoW/lock/read/write/cache 경계의 관찰 가능한 순서
    const events: string[] = [];
    class OrderedUnitOfWork extends ImmediateUnitOfWork {
      override async run<T>(work: () => Promise<T>): Promise<T> {
        events.push("uow:start");
        const result = await work();
        events.push("uow:resolved");
        return result;
      }
    }
    class OrderedMutationLock extends RecordingMutationLock {
      override async acquire(keys: readonly string[]): Promise<void> {
        events.push("lock");
        await super.acquire(keys);
      }
    }
    class OrderedLimitReader extends StubTodoCategoryLimitReader {
      override async readLimitInTx(): Promise<number | null> {
        events.push("entitlement");
        return 3;
      }
    }
    class OrderedRepository extends InMemoryTodoCategoryRepository {
      override async countByUserId(userId: UserId): Promise<number> {
        events.push("count");
        return super.countByUserId(userId);
      }
      override async existsByUserIdAndName(userId: UserId, name: string): Promise<boolean> {
        events.push("name-read");
        return super.existsByUserIdAndName(userId, name);
      }
      override async getMaxSortOrder(userId: UserId): Promise<number> {
        events.push("max-order-read");
        return super.getMaxSortOrder(userId);
      }
      override async insert(category: TodoCategory): Promise<void> {
        events.push("insert");
        await super.insert(category);
      }
    }
    class OrderedCache extends FakeTodoCategoryCache {
      override async invalidate(userId: UserId): Promise<void> {
        events.push("cache");
        await super.invalidate(userId);
      }
    }
    const mutationLock = new OrderedMutationLock();
    const { useCase } = setUp({
      repository: new OrderedRepository(existingCategories()),
      limitReader: new OrderedLimitReader(),
      cache: new OrderedCache(),
      mutationLock,
      unitOfWork: new OrderedUnitOfWork(),
    });

    // When - 새 카테고리 생성
    await useCase.execute({ userId: USER_ID, name: "새 카테고리", color: "#FFB3B3" });

    // Then - 한 user-scoped key가 모든 구조 읽기보다 먼저이고 cache는 callback 성공 뒤
    expect(mutationLock.acquiredKeys).toEqual([[`mutation:v1:todo-category:${USER_ID}`]]);
    expect(events).toEqual([
      "uow:start",
      "lock",
      "entitlement",
      "count",
      "name-read",
      "max-order-read",
      "insert",
      "uow:resolved",
      "cache",
    ]);
  });
});
