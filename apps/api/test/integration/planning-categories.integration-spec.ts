import { ErrorCode } from "@aido/api/errors";
import { omit } from "es-toolkit";

import {
  TODO_CATEGORY_REPOSITORY,
  type TodoCategoryRepositoryPort,
} from "#api/modules/planning/application/ports/categories/todo-category.repository.port";
import { DeleteTodoCategory } from "#api/modules/planning/application/use-cases/categories/delete-todo-category.use-case";
import { GetTodoCategories } from "#api/modules/planning/application/use-cases/categories/get-todo-categories.use-case";
import { GetTodoCategoryResourceLimit } from "#api/modules/planning/application/use-cases/categories/get-todo-category-resource-limit.use-case";
import { GetTodoCategory } from "#api/modules/planning/application/use-cases/categories/get-todo-category.use-case";
import { UpdateTodoCategory } from "#api/modules/planning/application/use-cases/categories/update-todo-category.use-case";
import {
  TODO_CATEGORY_PROVISIONER,
  type TodoCategoryProvisionerPort,
} from "#api/modules/planning/planning-categories.public";
import { decodeRecord, encodeCreate } from "#api/platform/database/database-records";
import { createEntityId } from "#api/platform/database/database-values";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { TodoFixture, UserFixture } from "#test/fixtures/index";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../e2e/helpers/e2e-app-factory.js";

const at = new Date("2027-02-01T12:00:00.000Z");

describe("Planning 카테고리 상태·조회·트랜잭션 (실제 PostgreSQL)", () => {
  let context: E2eTestContext;
  let repository: TodoCategoryRepositoryPort;
  let update: UpdateTodoCategory;
  let userId: string;
  let categoryId: number;

  beforeAll(async () => {
    context = await createE2eApp();
    repository = context.module.get(TODO_CATEGORY_REPOSITORY);
    update = context.module.get(UpdateTodoCategory);
  });

  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at);
    userId = createEntityId();
    await context.testDatabase.getClient().orm.public.User.create(
      encodeCreate(
        "User",
        UserFixture.create({
          id: userId,
          email: "planning-category-owner@example.com",
          userTag: "PLANCA01",
          createdAt: at,
          updatedAt: at,
        }),
      ),
    );
    categoryId = (await repository.create({ userId, name: "기존", color: "#FFB3B3", sortOrder: 0 }))
      .id;
  });

  afterEach(() => vi.useRealTimers());
  afterAll(async () => {
    if (context) await destroyE2eApp(context);
  });

  it("없는 카테고리와 다른 사용자 카테고리는 각각 기존 404·403 업무 오류를 유지한다", async () => {
    // Given
    const getCategory = context.module.get(GetTodoCategory);
    // When / Then
    await expect(getCategory.execute({ id: categoryId + 1, userId })).rejects.toMatchObject({
      errorCode: ErrorCode.TODO_CATEGORY_0851,
    });
    await expect(
      getCategory.execute({ id: categoryId, userId: "another-user" }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_CATEGORY_0852 });
  });

  it("이름만 수정하면 색상을 유지하고 warm 목록 캐시도 갱신한다", async () => {
    // Given
    const getCategories = context.module.get(GetTodoCategories);
    expect((await getCategories.execute({ userId }))[0]?.name).toBe("기존");
    // When
    await update.execute({ id: categoryId, userId, data: { name: "변경" } });
    const categories = await getCategories.execute({ userId });
    // Then
    expect(categories).toHaveLength(1);
    expect(categories[0]).toMatchObject({ name: "변경", color: "#FFB3B3" });
  });

  it("유효한 이름과 잘못된 색상을 함께 수정하면 DB와 목록 캐시는 이전 상태를 유지한다", async () => {
    // Given
    const getCategories = context.module.get(GetTodoCategories);
    const before = await getCategories.execute({ userId });
    // When
    await expect(
      update.execute({ id: categoryId, userId, data: { name: "변경", color: "invalid" } }),
    ).rejects.toBeInstanceOf(Error);
    // Then
    expect(await repository.findByIdAndUserId(categoryId, userId)).toMatchObject({
      name: "기존",
      color: "#FFB3B3",
    });
    expect(await getCategories.execute({ userId })).toEqual(before);
  });

  it("상위 UoW가 실패하면 카테고리 변경도 같은 트랜잭션에서 rollback된다", async () => {
    // Given
    const unitOfWork = context.module.get<UnitOfWorkPort>(UNIT_OF_WORK);
    const failure = new Error("rollback-category");
    // When
    await expect(
      unitOfWork.run(async () => {
        await update.execute({ id: categoryId, userId, data: { name: "변경" } });
        throw failure;
      }),
    ).rejects.toBe(failure);
    // Then
    expect(await repository.findByIdAndUserId(categoryId, userId)).toMatchObject({ name: "기존" });
  });

  it("동시 이름·색상 수정은 서로의 요청하지 않은 필드를 덮지 않는다", async () => {
    // Given
    // When
    await Promise.all([
      update.execute({ id: categoryId, userId, data: { name: "변경" } }),
      update.execute({ id: categoryId, userId, data: { color: "#112233" } }),
    ]);
    // Then
    expect(await repository.findByIdAndUserId(categoryId, userId)).toMatchObject({
      name: "변경",
      color: "#112233",
    });
  });

  it("같은 사용자 이름 중복은 기존 409 업무 오류이며 다른 카테고리는 유지한다", async () => {
    // Given
    const another = await repository.create({
      userId,
      name: "다른",
      color: "#112233",
      sortOrder: 1,
    });
    // When
    await expect(
      update.execute({ id: another.id, userId, data: { name: "기존" } }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_CATEGORY_0853 });
    // Then
    expect(await repository.findByIdAndUserId(another.id, userId)).toMatchObject({ name: "다른" });
  });

  it("카테고리 삭제 시 할 일을 대상에 일괄 이동하고 완료·정렬 상태를 보존한다", async () => {
    // Given
    const target = await repository.create({
      userId,
      name: "이동 대상",
      color: "#112233",
      sortOrder: 1,
    });
    const client = context.testDatabase.getClient();
    await client.orm.public.Todo.createAndCount([
      encodeCreate(
        "Todo",
        omit(
          TodoFixture.create({
            userId,
            categoryId,
            completed: false,
            sortOrder: 0,
            createdAt: at,
            updatedAt: at,
          }),
          ["id"],
        ),
      ),
      encodeCreate(
        "Todo",
        omit(
          TodoFixture.createCompleted({
            userId,
            categoryId,
            sortOrder: 1,
            createdAt: at,
            updatedAt: at,
          }),
          ["id"],
        ),
      ),
    ]);
    const before = decodeRecord(
      "Todo",
      await client.orm.public.Todo.where({ userId })
        .orderBy((todo) => todo.id.asc())
        .all(),
    );
    // When
    await context.module
      .get(DeleteTodoCategory)
      .execute({ userId, categoryId, moveToCategoryId: target.id });
    // Then
    const after = decodeRecord(
      "Todo",
      await client.orm.public.Todo.where({ userId })
        .orderBy((todo) => todo.id.asc())
        .all(),
    );
    expect(
      after.map((todo) => ({
        id: todo.id,
        completed: todo.completed,
        sortOrder: todo.sortOrder,
        categoryId: todo.categoryId,
      })),
    ).toEqual(
      before.map((todo) => ({
        id: todo.id,
        completed: todo.completed,
        sortOrder: todo.sortOrder,
        categoryId: target.id,
      })),
    );
    expect(await repository.findByIdAndUserId(categoryId, userId)).toBeNull();
    expect(
      await context.module.get(GetTodoCategory).execute({ id: target.id, userId }),
    ).toMatchObject({ todoCount: 2 });
  });

  it("자원 한도 조회는 사용자 카테고리 수와 기존 무료 한도를 반환한다", async () => {
    // Given
    const getLimit = context.module.get(GetTodoCategoryResourceLimit);
    // When
    const limit = await getLimit.execute({ userId });
    // Then
    expect(limit).toEqual({ categoryCount: 1, maxCount: 3 });
  });

  it("공개 기본 카테고리 provisioner도 상위 transaction rollback에 참여한다", async () => {
    // Given
    const unitOfWork = context.module.get<UnitOfWorkPort>(UNIT_OF_WORK);
    const provisioner = context.module.get<TodoCategoryProvisionerPort>(TODO_CATEGORY_PROVISIONER);
    const failure = new Error("rollback-default-categories");
    // When
    await expect(
      unitOfWork.run(async () => {
        await provisioner.seed(userId);
        throw failure;
      }),
    ).rejects.toBe(failure);
    // Then
    expect(await repository.countByUserId(userId)).toBe(1);
  });
});
