import { omit } from "es-toolkit";

import { MarkNudgeReadUseCase } from "#api/modules/social/nudges/application/use-cases/mark-nudge-read.use-case";
import { ReplyToNudgeUseCase } from "#api/modules/social/nudges/application/use-cases/reply-to-nudge.use-case";
import { DrizzleNudgeRepository } from "#api/modules/social/nudges/infrastructure/persistence/drizzle-nudge.repository";
import { requireRecord } from "#api/platform/database/database-error.util";
import { todo, todoCategory, user, userBlock } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { describeNudgeRepositoryContract } from "#test/contracts/social/nudge-repository.contract";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { RecordingNudgeNotifier } from "#test/doubles/social/recording-nudge-notifier";
import { StubFollowReader } from "#test/doubles/social/stub-follow-reader";
import { TodoCategoryFixture, TodoFixture, UserFixture } from "#test/fixtures/index";
import {
  createNudgeFixture,
  createNudgeTodoSeed,
  NUDGE_FIXTURE_NOW,
  NUDGE_FIXTURE_OTHER_USER_ID,
  NUDGE_FIXTURE_RECEIVER_ID,
  NUDGE_FIXTURE_SENDER_ID,
  type NudgeTodoSeed,
} from "#test/fixtures/social/nudge.fixture";
import { createReminderNudgeFixture } from "#test/fixtures/social/reminder-nudge.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const RECEIVER_ID = UserId.reconstitute(NUDGE_FIXTURE_RECEIVER_ID);
const SENDER_ID = UserId.reconstitute(NUDGE_FIXTURE_SENDER_ID);
const REPLIED_AT = NUDGE_FIXTURE_NOW.add({ minutes: 5 });

describe("DrizzleNudgeRepository (실제 PostgreSQL)", () => {
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
        UserFixture.create({ id: NUDGE_FIXTURE_SENDER_ID }),
        UserFixture.create({ id: NUDGE_FIXTURE_RECEIVER_ID }),
        UserFixture.create({ id: NUDGE_FIXTURE_OTHER_USER_ID }),
      ]);
  });

  afterAll(async () => {
    await database.stop();
  });

  function createRepository(): DrizzleNudgeRepository {
    const { txHost } = createDatabaseTransactionFixture(client);
    return new DrizzleNudgeRepository(txHost);
  }

  // DATE 컬럼은 UTC 자정 Date로 넣는다
  async function addTodo(seed: NudgeTodoSeed): Promise<number> {
    const [category] = await client
      .insert(todoCategory)
      .values(omit(TodoCategoryFixture.create({ userId: seed.ownerId }), ["id"]))
      .returning({ id: todoCategory.id });
    const [created] = await client
      .insert(todo)
      .values(
        omit(
          TodoFixture.create({
            userId: seed.ownerId,
            categoryId: requireRecord(category).id,
            title: seed.title,
            completed: seed.completed,
            visibility: seed.visibility,
            startDate: new Date(seed.startDate.toString()),
            endDate: seed.endDate == null ? null : new Date(seed.endDate.toString()),
            sortOrder: 0,
          }),
          ["id"],
        ),
      )
      .returning({ id: todo.id });
    return requireRecord(created).id;
  }

  describeNudgeRepositoryContract(async () => ({ repository: createRepository(), addTodo }));

  it("어느 쪽이든 차단한 상대의 콕은 목록·개수·단건 조회에서 빠진다", async () => {
    // Given
    const repository = createRepository();
    const todoId = await addTodo(createNudgeTodoSeed());
    const nudge = createNudgeFixture({ id: (await repository.nextId()).value, todoId });
    await repository.save(nudge);
    await client
      .insert(userBlock)
      .values({ blockerId: NUDGE_FIXTURE_RECEIVER_ID, blockedId: NUDGE_FIXTURE_SENDER_ID });

    // When
    const received = await repository.listReceived({
      userId: RECEIVER_ID,
      afterNudgeId: null,
      limit: 5,
    });
    const interactions = await repository.listInteractions({
      viewerId: SENDER_ID,
      direction: "sent",
      afterNudgeId: null,
      limit: 5,
    });
    const single = await repository.findInteraction(nudge.id, RECEIVER_ID);
    const counts = {
      received: await repository.countReceived(RECEIVER_ID),
      unread: await repository.countUnreadReceived(RECEIVER_ID),
      sent: await repository.countSent(SENDER_ID),
    };

    // Then
    expect({ received, interactions, single }).toEqual({
      received: [],
      interactions: [],
      single: null,
    });
    expect(counts).toEqual({ received: 0, unread: 0, sent: 0 });
  });

  it("시각은 ms 3자리 UTC로 저장하고 같은 Instant로 읽는다", async () => {
    // Given
    const repository = createRepository();
    const todoId = await addTodo(createNudgeTodoSeed());
    const createdAt = Temporal.Instant.from("2027-01-08T12:00:00.123Z");
    const nudge = createNudgeFixture({
      id: (await repository.nextId()).value,
      todoId,
      createdAt,
      readAt: createdAt.add({ seconds: 1 }),
      replyKind: "THANKFUL",
      repliedAt: createdAt.add({ seconds: 2 }),
      replyUpdatedAt: createdAt.add({ seconds: 3 }),
      thankedAt: createdAt.add({ seconds: 4 }),
    });
    const reminder = createReminderNudgeFixture({
      id: (await repository.nextReminderId()).value,
      createdAt,
    });

    // When
    await repository.save(nudge);
    await repository.saveReminder(reminder);
    const found = await repository.findById(nudge.id);
    const foundReminder = await repository.findLastReminderSentTo(SENDER_ID, RECEIVER_ID);

    // Then
    expect(found?.toPrimitives()).toEqual(nudge.toPrimitives());
    expect(foundReminder?.toPrimitives()).toEqual(reminder.toPrimitives());
  });

  it("답장 전에 읽기 시작한 읽음 처리가 답장 뒤에 끝나도 답장을 지우지 않는다", async () => {
    // Given
    const { txHost, uow } = createDatabaseTransactionFixture(client);
    const repository = new DrizzleNudgeRepository(txHost);
    const todoId = await addTodo(createNudgeTodoSeed());
    const nudge = createNudgeFixture({ id: (await repository.nextId()).value, todoId });
    await repository.save(nudge);
    const clock = new FixedClock(REPLIED_AT);
    const followReader = new StubFollowReader();
    followReader.addMutual(NUDGE_FIXTURE_SENDER_ID, NUDGE_FIXTURE_RECEIVER_ID);
    const reply = new ReplyToNudgeUseCase({
      unitOfWork: uow,
      nudgeRepository: repository,
      nudgeReader: repository,
      interactionConfig: { isEnabled: true },
      followReader,
      notifier: new RecordingNudgeNotifier(),
      clock,
    });
    const markRead = new MarkNudgeReadUseCase({
      unitOfWork: uow,
      nudgeRepository: repository,
      clock,
      logger: new SilentLogger(),
    });
    const findNudge = repository.findById.bind(repository);
    const firstRead = Promise.withResolvers<void>();
    const replied = Promise.withResolvers<void>();
    // 읽음 처리의 첫 조회만 답장이 커밋될 때까지 붙잡는다
    vi.spyOn(repository, "findById").mockImplementationOnce(async (nudgeId) => {
      const found = await findNudge(nudgeId);
      firstRead.resolve();
      await replied.promise;
      return found;
    });

    // When
    const marking = markRead.execute({
      userId: NUDGE_FIXTURE_RECEIVER_ID,
      nudgeId: nudge.id.value,
    });
    await firstRead.promise;
    try {
      await reply.execute({
        userId: NUDGE_FIXTURE_RECEIVER_ID,
        nudgeId: nudge.id.value,
        replyKind: "STARTING",
      });
    } finally {
      replied.resolve();
    }
    await marking;

    // Then
    expect((await findNudge(nudge.id))?.toPrimitives()).toMatchObject({
      readAt: REPLIED_AT,
      replyKind: "STARTING",
      repliedAt: REPLIED_AT,
      replyUpdatedAt: REPLIED_AT,
    });
  });
});
