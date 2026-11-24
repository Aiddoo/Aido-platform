import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { InMemoryTodoCategoryRepository } from "#test/doubles/planning/in-memory-todo-category.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { createTodoCategoryFixture } from "#test/fixtures/planning/todo-category.fixture";
import { TODO_FIXTURE_NOW, TODO_FIXTURE_USER_ID } from "#test/fixtures/planning/todo.fixture";

import { CategoryColor } from "../../domain/category-color.vo.js";
import { CategoryName } from "../../domain/category-name.vo.js";
import {
  type TodoCategoryFeatureQuota,
  TodoCategoryLimitReaderPort,
} from "../ports/todo-category-limit.reader.port.js";
import {
  type NonEmptyList,
  type TodoCategoryDraft,
  WriteTodoCategoryUseCase,
} from "./write-todo-category.use-case.js";

const USER_ID = UserId.reconstitute(TODO_FIXTURE_USER_ID);
const FEATURE_QUOTA = { feature: "TODO_CATEGORY", limit: 3 };

class StubTodoCategoryLimitReader extends TodoCategoryLimitReaderPort {
  readonly quotaReads: number[] = [];
  readonly #maxCount: number | null;

  constructor(maxCount: number | null) {
    super();
    this.#maxCount = maxCount;
  }

  async readLimit(): Promise<number | null> {
    return this.#maxCount;
  }

  async readLimitInTransaction(): Promise<number | null> {
    return this.#maxCount;
  }

  async readFeatureQuotaInTransaction(
    _userId: UserId,
    count: number,
  ): Promise<TodoCategoryFeatureQuota> {
    this.quotaReads.push(count);
    return FEATURE_QUOTA;
  }
}

function setUp(maxCount: number | null) {
  const repository = new InMemoryTodoCategoryRepository([
    createTodoCategoryFixture({ id: 1, name: "업무", sortOrder: 4 }),
  ]);
  const limitReader = new StubTodoCategoryLimitReader(maxCount);
  const useCase = new WriteTodoCategoryUseCase({
    repository,
    limitReader,
    clock: new FixedClock(TODO_FIXTURE_NOW),
  });
  return { repository, limitReader, useCase };
}

function drafts(...names: [string, ...string[]]): NonEmptyList<TodoCategoryDraft> {
  const [first, ...rest] = names;
  const toDraft = (name: string): TodoCategoryDraft => ({
    name: CategoryName.create(name),
    color: CategoryColor.create("#FFB3B3"),
  });
  return [toDraft(first), ...rest.map(toDraft)];
}

describe("WriteTodoCategoryUseCase", () => {
  it("여러 카테고리를 넣은 순서대로 맨 뒤 순번에 이어 만든다", async () => {
    // Given
    const { repository, useCase } = setUp(3);

    // When
    const created = await useCase.execute({ userId: USER_ID, drafts: drafts("수업", "알바") });

    // Then
    const listed = await repository.listByUserId(USER_ID);
    expect(listed.map(({ name, sortOrder }) => [name, sortOrder])).toEqual([
      ["업무", 4],
      ["수업", 5],
      ["알바", 6],
    ]);
    expect(created.map((category) => category.name.value)).toEqual(["수업", "알바"]);
  });

  it("묶음 전체가 한도를 넘으면 하나도 만들지 않고 지금 개수로 TODO_CATEGORY_0857을 낸다", async () => {
    // Given
    const { repository, limitReader, useCase } = setUp(2);

    // When
    const writing = useCase.execute({ userId: USER_ID, drafts: drafts("수업", "알바") });

    // Then
    await expect(writing).rejects.toMatchObject({
      errorCode: ErrorCode.TODO_CATEGORY_0857,
      details: { charged: false, featureQuota: FEATURE_QUOTA },
    });
    expect(limitReader.quotaReads).toEqual([1]);
    expect(await repository.countByUserId(USER_ID)).toBe(1);
  });

  it.each([
    { label: "이미 있는 이름", names: ["수업", "업무"] satisfies [string, ...string[]] },
    { label: "묶음 안에서 겹치는 이름", names: ["업무2", "업무2"] satisfies [string, ...string[]] },
  ])("$label이면 TODO_CATEGORY_0853이고 하나도 만들지 않는다", async ({ names }) => {
    // Given
    const { repository, useCase } = setUp(null);

    // When
    const writing = useCase.execute({ userId: USER_ID, drafts: drafts(...names) });

    // Then
    await expect(writing).rejects.toMatchObject({ errorCode: ErrorCode.TODO_CATEGORY_0853 });
    expect(await repository.countByUserId(USER_ID)).toBe(1);
  });
});
