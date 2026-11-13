import { omit } from "es-toolkit";

import { DrizzleReminderNudgeRepository } from "#api/modules/social/reminder-nudges/infrastructure/persistence/drizzle-reminder-nudge.repository";
import { DrizzleReminderTargetReader } from "#api/modules/social/reminder-nudges/infrastructure/persistence/drizzle-reminder-target.reader";
import { requireRecord } from "#api/platform/database/database-error.util";
import { todo, todoCategory, user } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { describeReminderNudgeRepositoryContract } from "#test/contracts/social/reminder-nudge-repository.contract";
import { nowInstant } from "#test/fixtures/clock.fixture";
import { TodoCategoryFixture, TodoFixture, UserFixture } from "#test/fixtures/index";
import {
  createReminderNudgeFixture,
  REMINDER_NUDGE_FIXTURE_OTHER_USER_ID,
  REMINDER_NUDGE_FIXTURE_RECEIVER_ID,
  REMINDER_NUDGE_FIXTURE_SENDER_ID,
  type ReminderTargetTodoSeed,
} from "#test/fixtures/social/reminder-nudge.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

describe("DrizzleReminderNudgeRepository·DrizzleReminderTargetReader (실제 PostgreSQL)", () => {
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
        UserFixture.create({ id: REMINDER_NUDGE_FIXTURE_SENDER_ID }),
        UserFixture.create({ id: REMINDER_NUDGE_FIXTURE_RECEIVER_ID }),
        UserFixture.create({ id: REMINDER_NUDGE_FIXTURE_OTHER_USER_ID }),
      ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  function createRepository(): DrizzleReminderNudgeRepository {
    const { txHost } = createDatabaseTransactionFixture(client);
    return new DrizzleReminderNudgeRepository(txHost);
  }

  async function addTodo(seed: ReminderTargetTodoSeed): Promise<void> {
    const [category] = await client
      .insert(todoCategory)
      .values(omit(TodoCategoryFixture.create({ userId: seed.ownerId }), ["id"]))
      .returning({ id: todoCategory.id });
    await client.insert(todo).values(
      omit(
        TodoFixture.create({
          userId: seed.ownerId,
          categoryId: requireRecord(category).id,
          startDate: seed.startDate,
          endDate: seed.endDate,
          sortOrder: 0,
          updatedAt: nowInstant(),
        }),
        ["id"],
      ),
    );
  }

  describeReminderNudgeRepositoryContract(async () => {
    const { txHost } = createDatabaseTransactionFixture(client);
    return {
      repository: new DrizzleReminderNudgeRepository(txHost),
      targetReader: new DrizzleReminderTargetReader(txHost),
      addTodo,
    };
  });

  it("만든 시각은 ms 3자리 UTC로 저장하고 같은 Instant로 읽는다", async () => {
    // Given
    const repository = createRepository();
    const reminder = createReminderNudgeFixture({
      id: (await repository.nextId()).value,
      message: "오늘 할 일 만들자",
      createdAt: Temporal.Instant.from("2027-01-08T12:00:00.123Z"),
    });

    // When
    await repository.save(reminder);
    const found = await repository.findLastSentTo(
      UserId.reconstitute(REMINDER_NUDGE_FIXTURE_SENDER_ID),
      UserId.reconstitute(REMINDER_NUDGE_FIXTURE_RECEIVER_ID),
    );

    // Then
    expect(found?.toPrimitives()).toEqual(reminder.toPrimitives());
  });
});
