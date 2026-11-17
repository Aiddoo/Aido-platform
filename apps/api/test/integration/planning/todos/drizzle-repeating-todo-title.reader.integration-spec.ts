import { eq } from "drizzle-orm";
import { omit } from "es-toolkit";

import { DrizzleRepeatingTodoTitleReader } from "#api/modules/planning/todos/infrastructure/persistence/drizzle-repeating-todo-title.reader";
import { todoCategory, todoSeries, user } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createEntityId } from "#api/shared/domain/model/entity-id";
import { TodoCategoryFixture, UserFixture } from "#test/fixtures/index";
import {
  TODO_FIXTURE_NOW,
  TODO_FIXTURE_OTHER_USER_ID,
  TODO_FIXTURE_USER_ID,
} from "#test/fixtures/planning/todo.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const NEXT_DATE = Temporal.PlainDate.from("2026-11-17");

describe("DrizzleRepeatingTodoTitleReader (실제 PostgreSQL)", () => {
  const database = new TestDatabase();
  let client: TestDatabaseClient;
  let reader: DrizzleRepeatingTodoTitleReader;

  beforeAll(async () => {
    client = await database.start();
    reader = new DrizzleRepeatingTodoTitleReader(
      createDatabaseTransactionFixture(client).transactionHost,
    );
  });

  beforeEach(async () => {
    await database.cleanup();
    await client
      .insert(user)
      .values([
        UserFixture.create({ id: TODO_FIXTURE_USER_ID, userTag: "REPEAT01" }),
        UserFixture.create({ id: TODO_FIXTURE_OTHER_USER_ID, userTag: "REPEAT02" }),
      ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  async function givenSeries(
    rows: readonly {
      readonly title: string;
      readonly nextOccurrenceDate: Temporal.PlainDate | null;
      readonly userId?: string;
    }[],
  ): Promise<string[]> {
    const categories = await client
      .insert(todoCategory)
      .values(
        [TODO_FIXTURE_USER_ID, TODO_FIXTURE_OTHER_USER_ID].map((userId) =>
          omit(TodoCategoryFixture.create({ userId }), ["id"]),
        ),
      )
      .returning({ id: todoCategory.id, userId: todoCategory.userId });
    const ids = rows.map(() => createEntityId());
    await client.insert(todoSeries).values(
      rows.map((row, index) => {
        const userId = row.userId ?? TODO_FIXTURE_USER_ID;
        const id = ids[index] ?? createEntityId();
        return {
          id,
          originSeriesId: id,
          userId,
          categoryId: categories.find((category) => category.userId === userId)?.id ?? 0,
          title: row.title,
          timezone: "Asia/Seoul",
          repeatFrequency: "DAILY" as const,
          startDate: Temporal.PlainDate.from("2026-11-01"),
          nextOccurrenceDate: row.nextOccurrenceDate,
          updatedAt: TODO_FIXTURE_NOW,
        };
      }),
    );
    return ids;
  }

  it("내 진행 중인 반복 제목만 한 번씩 주고 끝난·지운 반복과 다른 사람 반복은 뺀다", async () => {
    // Given
    const [, , , deletedId] = await givenSeries([
      { title: "물 마시기", nextOccurrenceDate: NEXT_DATE },
      { title: "물 마시기", nextOccurrenceDate: NEXT_DATE },
      { title: "러닝", nextOccurrenceDate: null },
      { title: "독서", nextOccurrenceDate: NEXT_DATE },
      { title: "요가", nextOccurrenceDate: NEXT_DATE, userId: TODO_FIXTURE_OTHER_USER_ID },
      { title: "스트레칭", nextOccurrenceDate: NEXT_DATE },
    ]);
    await client.delete(todoSeries).where(eq(todoSeries.id, deletedId ?? ""));

    // When
    const titles = await reader.listActiveTitles(UserId.reconstitute(TODO_FIXTURE_USER_ID));

    // Then
    expect(titles.toSorted()).toEqual(["물 마시기", "스트레칭"]);
  });
});
