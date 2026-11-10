import { DrizzleDailyCompletionRepository } from "#api/modules/insights/daily-completions/infrastructure/persistence/drizzle-daily-completion.repository";
import { todo, todoCategory, user } from "#api/platform/database/schema/index";
import { describeDailyCompletionRepositoryContract } from "#test/contracts/insights/daily-completion-repository.contract";
import { UserFixture } from "#test/fixtures/index";
import {
  DAILY_COMPLETION_FIXTURE_FRIEND_ID,
  DAILY_COMPLETION_FIXTURE_USER_ID,
  type TodoSeed,
} from "#test/fixtures/insights/daily-completion.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

// planning Todo의 date 칸은 UTC 자정 Date로 오간다
function toDateColumn(date: Temporal.PlainDate): Date {
  return new Date(`${date.toString()}T00:00:00.000Z`);
}

describe("DrizzleDailyCompletionRepository (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    await client
      .insert(user)
      .values([
        UserFixture.create({ id: DAILY_COMPLETION_FIXTURE_USER_ID }),
        UserFixture.create({ id: DAILY_COMPLETION_FIXTURE_FRIEND_ID }),
      ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  // 사용자·색마다 카테고리 하나를 만들고 할 일을 심는다
  async function seed(todos: readonly TodoSeed[]): Promise<void> {
    const categoryIds = new Map<string, number>();
    for (const seedTodo of todos) {
      const key = `${seedTodo.userId}:${seedTodo.categoryColor}`;
      let categoryId = categoryIds.get(key);
      if (categoryId == null) {
        const [category] = await client
          .insert(todoCategory)
          .values({
            userId: seedTodo.userId,
            name: `카테고리 ${categoryIds.size}`,
            color: seedTodo.categoryColor,
            sortOrder: categoryIds.size,
          })
          .returning({ id: todoCategory.id });
        if (category == null) {
          throw new Error("category fixture was not created");
        }
        categoryId = category.id;
        categoryIds.set(key, categoryId);
      }
      await client.insert(todo).values({
        userId: seedTodo.userId,
        categoryId,
        title: "일일 완료 집계 fixture",
        startDate: toDateColumn(seedTodo.startDate),
        endDate: seedTodo.endDate == null ? null : toDateColumn(seedTodo.endDate),
        completed: seedTodo.completed,
        visibility: seedTodo.isPublic ? "PUBLIC" : "PRIVATE",
      });
    }
  }

  describeDailyCompletionRepositoryContract(async (todos) => {
    await seed(todos);
    const { txHost } = createDatabaseTransactionFixture(client);
    return new DrizzleDailyCompletionRepository(txHost);
  });
});
