import { ErrorCode } from "@aido/api/errors";
import { asc, eq } from "drizzle-orm";
import { omit } from "es-toolkit";

import { TodoCategoryRepositoryPort } from "#api/modules/planning/categories/application/ports/todo-category.repository.port";
import { DeleteTodoCategoryUseCase } from "#api/modules/planning/categories/application/use-cases/delete-todo-category.use-case";
import { GetTodoCategoryResourceLimitUseCase } from "#api/modules/planning/categories/application/use-cases/get-todo-category-resource-limit.use-case";
import { GetTodoCategoryUseCase } from "#api/modules/planning/categories/application/use-cases/get-todo-category.use-case";
import { ListTodoCategoriesUseCase } from "#api/modules/planning/categories/application/use-cases/list-todo-categories.use-case";
import { UpdateTodoCategoryUseCase } from "#api/modules/planning/categories/application/use-cases/update-todo-category.use-case";
import type { TodoCategory } from "#api/modules/planning/categories/domain/todo-category.aggregate";
import { TodoCategoryProvisionerPort } from "#api/modules/planning/categories/planning-categories.public";
import { createEntityId } from "#api/platform/database/entity-id";
import { todo, user } from "#api/platform/database/schema/index";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { TodoFixture, UserFixture } from "#test/fixtures/index";
import { createTodoCategoryFixture } from "#test/fixtures/planning/todo-category.fixture";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../e2e/helpers/e2e-app-factory.js";

const at = new Date("2027-02-01T12:00:00.000Z");

describe("Planning 카테고리 상태·조회·트랜잭션 (실제 PostgreSQL)", () => {
  let context: E2eTestContext;
  let repository: TodoCategoryRepositoryPort;
  let update: UpdateTodoCategoryUseCase;
  let userId: string;
  let categoryId: number;

  beforeAll(async () => {
    context = await createE2eApp();
    repository = context.module.get(TodoCategoryRepositoryPort);
    update = context.module.get(UpdateTodoCategoryUseCase);
  });

  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at);
    userId = createEntityId();
    await context.testDatabase
      .getClient()
      .insert(user)
      .values(
        UserFixture.create({
          id: userId,
          email: "planning-category-owner@example.com",
          userTag: "PLANCA01",
          createdAt: instantFromDate(at),
          updatedAt: instantFromDate(at),
        }),
      );
    categoryId = (await insertCategory({ name: "기존", color: "#FFB3B3", sortOrder: 0 })).id.value;
  });

  async function insertCategory(input: {
    readonly name: string;
    readonly color: string;
    readonly sortOrder: number;
  }): Promise<TodoCategory> {
    const category = createTodoCategoryFixture({
      ...input,
      id: (await repository.nextId()).value,
      userId,
    });
    await repository.insert(category);
    return category;
  }

  afterEach(() => vi.useRealTimers());
  afterAll(async () => {
    if (context) {
      await destroyE2eApp(context);
    }
  });

  it("없는 카테고리와 다른 사용자 카테고리는 각각 기존 404·403 업무 오류를 유지한다", async () => {
    // Given
    const getCategory = context.module.get(GetTodoCategoryUseCase);

    // When
    const [missing, foreign] = await Promise.allSettled([
      getCategory.execute({ id: categoryId + 1, userId }),
      getCategory.execute({ id: categoryId, userId: "another-user" }),
    ]);

    // Then
    expect(missing).toMatchObject({
      status: "rejected",
      reason: { errorCode: ErrorCode.TODO_CATEGORY_0851 },
    });
    expect(foreign).toMatchObject({
      status: "rejected",
      reason: { errorCode: ErrorCode.TODO_CATEGORY_0852 },
    });
  });

  it("이름만 수정하면 색상을 유지하고 warm 목록 캐시도 갱신한다", async () => {
    // Given
    const getCategories = context.module.get(ListTodoCategoriesUseCase);
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
    const getCategories = context.module.get(ListTodoCategoriesUseCase);
    const before = await getCategories.execute({ userId });

    // When
    await expect(
      update.execute({ id: categoryId, userId, data: { name: "변경", color: "invalid" } }),
    ).rejects.toBeInstanceOf(Error);

    // Then
    expect((await repository.findByIdAndUserId(categoryId, userId))?.toPrimitives()).toMatchObject({
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
    expect((await repository.findByIdAndUserId(categoryId, userId))?.toPrimitives()).toMatchObject({
      name: "기존",
    });
  });

  it("동시 이름·색상 수정은 서로의 요청하지 않은 필드를 덮지 않는다", async () => {
    // Given

    // When
    await Promise.all([
      update.execute({ id: categoryId, userId, data: { name: "변경" } }),
      update.execute({ id: categoryId, userId, data: { color: "#112233" } }),
    ]);

    // Then
    expect((await repository.findByIdAndUserId(categoryId, userId))?.toPrimitives()).toMatchObject({
      name: "변경",
      color: "#112233",
    });
  });

  it("같은 사용자 이름 중복은 기존 409 업무 오류이며 다른 카테고리는 유지한다", async () => {
    // Given
    const another = await insertCategory({ name: "다른", color: "#112233", sortOrder: 1 });

    // When
    await expect(
      update.execute({ id: another.id.value, userId, data: { name: "기존" } }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.TODO_CATEGORY_0853 });

    // Then
    expect(
      (await repository.findByIdAndUserId(another.id.value, userId))?.toPrimitives(),
    ).toMatchObject({
      name: "다른",
    });
  });

  it("카테고리 삭제 시 할 일을 대상에 일괄 이동하고 완료·정렬 상태를 보존한다", async () => {
    // Given
    const target = await insertCategory({ name: "이동 대상", color: "#112233", sortOrder: 1 });
    const client = context.testDatabase.getClient();
    await client.insert(todo).values([
      omit(
        TodoFixture.create({
          userId,
          categoryId,
          completed: false,
          sortOrder: 0,
          createdAt: instantFromDate(at),
          updatedAt: instantFromDate(at),
        }),
        ["id"],
      ),
      omit(
        TodoFixture.createCompleted({
          userId,
          categoryId,
          sortOrder: 1,
          createdAt: instantFromDate(at),
          updatedAt: instantFromDate(at),
        }),
        ["id"],
      ),
    ]);
    const before = await client
      .select()
      .from(todo)
      .where(eq(todo.userId, userId))
      .orderBy(asc(todo.id));

    // When
    await context.module
      .get(DeleteTodoCategoryUseCase)
      .execute({ userId, categoryId, moveToCategoryId: target.id.value });

    // Then
    const after = await client
      .select()
      .from(todo)
      .where(eq(todo.userId, userId))
      .orderBy(asc(todo.id));
    expect(
      after.map((row) => ({
        id: row.id,
        completed: row.completed,
        sortOrder: row.sortOrder,
        categoryId: row.categoryId,
      })),
    ).toEqual(
      before.map((row) => ({
        id: row.id,
        completed: row.completed,
        sortOrder: row.sortOrder,
        categoryId: target.id.value,
      })),
    );
    expect(await repository.findByIdAndUserId(categoryId, userId)).toBeNull();
    expect(
      await context.module.get(GetTodoCategoryUseCase).execute({ id: target.id.value, userId }),
    ).toMatchObject({ todoCount: 2 });
  });

  it("자원 한도 조회는 사용자 카테고리 수와 기존 무료 한도를 반환한다", async () => {
    // Given
    const getLimit = context.module.get(GetTodoCategoryResourceLimitUseCase);

    // When
    const limit = await getLimit.execute({ userId });

    // Then
    expect(limit).toEqual({ categoryCount: 1, maxCount: 3 });
  });

  it("공개 기본 카테고리 provisioner도 상위 transaction rollback에 참여한다", async () => {
    // Given
    const unitOfWork = context.module.get<UnitOfWorkPort>(UNIT_OF_WORK);
    const provisioner = context.module.get<TodoCategoryProvisionerPort>(
      TodoCategoryProvisionerPort,
    );
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

  it.each([
    { why: "언어를 모르는 구 앱은 한국어", locale: undefined, names: ["중요한 일", "할 일"] },
    { why: "영어로 가입하면 영어", locale: "en", names: ["Important", "To-do"] },
  ] as const)("기본 카테고리 이름은 $why로 만든다", async ({ locale, names }) => {
    // Given
    const unitOfWork = context.module.get<UnitOfWorkPort>(UNIT_OF_WORK);
    const provisioner = context.module.get<TodoCategoryProvisionerPort>(
      TodoCategoryProvisionerPort,
    );

    // When
    await unitOfWork.run(() => provisioner.seed(userId, locale));

    // Then
    const categories = await repository.findManyByUserId(userId);
    expect(categories.map(({ name }) => name)).toEqual(expect.arrayContaining([...names]));
  });
});
