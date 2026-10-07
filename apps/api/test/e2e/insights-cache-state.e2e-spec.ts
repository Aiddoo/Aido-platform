import { dailyCompletionsRangeResponseSchema } from "@aido/api";
import request from "supertest";

import {
  TODO_COMPLETION_REPOSITORY,
  type TodoCompletionRepositoryPort,
} from "#api/modules/insights/application/ports/daily-completions/todo-completion.repository.port";
import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "#test/e2e/helpers/e2e-app-factory";
import { INSIGHTS_TIME } from "#test/fixtures/insights.fixture";

describe("일일 집계 캐시 정합성 실제 HTTP·PostgreSQL", () => {
  let context: E2eTestContext;
  beforeAll(async () => {
    context = await createE2eApp();
  }, 60000);
  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(INSIGHTS_TIME);
  });

  afterEach(() => vi.useRealTimers());

  afterAll(async () => {
    await destroyE2eApp(context);
  });

  async function prepare(email: string) {
    const user = await context.helpers.createVerifiedUser(email, "CorrectPassword1!");
    const client = context.testDatabase.getClient();
    const categories = await client.orm.public.TodoCategory.where({ userId: user.userId })
      .select("id")
      .all();
    const source = categories[0];
    const target = categories[1];
    if (source === undefined || target === undefined)
      throw new Error("서로 다른 기본 카테고리가 필요합니다.");
    await request(context.app.getHttpServer())
      .patch(`/v1/todo-categories/${source.id}`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ color: "#123456" })
      .expect(200);
    await request(context.app.getHttpServer())
      .patch(`/v1/todo-categories/${target.id}`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ color: "#654321" })
      .expect(200);
    const created = await request(context.app.getHttpServer())
      .post("/v1/todos")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ title: "완료 집계 회귀", categoryId: source.id, startDate: "2028-02-29" })
      .expect(201);
    return { user, sourceId: source.id, targetId: target.id, todoId: created.body.data.todo.id };
  }

  function read(token: string) {
    return request(context.app.getHttpServer())
      .get("/v1/daily-completions")
      .set("Authorization", `Bearer ${token}`)
      .query({ startDate: "2028-02-29", endDate: "2028-02-29" })
      .then((response) => response);
  }

  it("집계를 warm한 뒤 카테고리 색상을 바꾸면 새 색상으로 응답해야 한다", async () => {
    // Given
    const { user, sourceId } = await prepare("insights-category-color@example.com");
    const warm = await read(user.accessToken);
    expect(warm.body.data.completions[0].categoryColors).toEqual(["#123456"]);
    // When
    await request(context.app.getHttpServer())
      .patch(`/v1/todo-categories/${sourceId}`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ color: "#ABCDEF" })
      .expect(200);
    const after = await read(user.accessToken);
    expect(after.status).toBe(200);
    dailyCompletionsRangeResponseSchema.parse(after.body.data);
    // Then
    expect(after.body.data.completions[0].categoryColors).toEqual(["#ABCDEF"]);
  });

  it("카테고리 삭제로 할 일을 이동하면 집계는 대상 카테고리 색상으로 응답해야 한다", async () => {
    // Given
    const { user, sourceId, targetId } = await prepare("insights-category-move@example.com");
    await read(user.accessToken);
    // When
    await request(context.app.getHttpServer())
      .delete(`/v1/todo-categories/${sourceId}`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .query({ moveToCategoryId: targetId })
      .expect(200);
    const after = await read(user.accessToken);
    expect(after.status).toBe(200);
    dailyCompletionsRangeResponseSchema.parse(after.body.data);
    // Then
    expect(after.body.data.completions[0].categoryColors).toEqual(["#654321"]);
  });

  it("이전 집계 조회와 완료 쓰기가 겹쳐도 이후 응답은 새 완료 상태를 유지해야 한다", async () => {
    // Given
    const { user, todoId } = await prepare("insights-cache-race@example.com");
    const repository = context.app.get<TodoCompletionRepositoryPort>(TODO_COMPLETION_REPOSITORY);
    const original = repository.aggregateByDateRange.bind(repository);
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const aggregate = vi
      .spyOn(repository, "aggregateByDateRange")
      .mockImplementationOnce(async (params) => {
        const result = await original(params);
        entered.resolve();
        await release.promise;
        return result;
      });
    const earlierRead = read(user.accessToken);
    await Promise.race([
      entered.promise,
      earlierRead.then(() => {
        throw new Error("집계 gate 이전 종료");
      }),
    ]);
    // When
    try {
      await request(context.app.getHttpServer())
        .patch(`/v1/todos/${todoId}/complete`)
        .set("Authorization", `Bearer ${user.accessToken}`)
        .send({ completed: true })
        .expect(200);
    } finally {
      release.resolve();
      try {
        await earlierRead;
      } finally {
        aggregate.mockRestore();
      }
    }
    const after = await read(user.accessToken);
    expect(after.status).toBe(200);
    dailyCompletionsRangeResponseSchema.parse(after.body.data);
    const persisted = await context.testDatabase
      .getClient()
      .orm.public.Todo.where({ id: todoId })
      .select("completed")
      .first();
    // Then
    expect(persisted?.completed).toBe(true);
    expect(after.body.data.completions[0].completedTodos).toBe(1);
  });

  it("윤년 2월 29일은 조회하고 존재하지 않는 2월 30일은 400으로 거절한다", async () => {
    // Given
    const { user } = await prepare("insights-invalid-date@example.com");
    // When
    const valid = await read(user.accessToken);
    const invalid = await request(context.app.getHttpServer())
      .get("/v1/daily-completions")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .query({ startDate: "2028-02-30", endDate: "2028-02-30" })
      .expect(400);
    // Then
    expect(valid.status).toBe(200);
    const result = dailyCompletionsRangeResponseSchema.parse(valid.body.data);
    expect(result.dateRange).toEqual({ startDate: "2028-02-29", endDate: "2028-02-29" });
    expect(result.completions.map((item) => item.date)).toEqual(["2028-02-29"]);
    expect(invalid.body.error.code).toBe("SYS_0002");
  });
});
