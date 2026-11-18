import { TodoCommentId } from "#api/modules/engagement/shared/domain/todo-comment-id.vo";
import { DrizzleTodoCommentLikeRepository } from "#api/modules/engagement/todo-comment-likes/infrastructure/persistence/drizzle-todo-comment-like.repository";
import { DELETED_COMMENT_AUTHOR } from "#api/modules/engagement/todo-comments/domain/todo-comments.constants";
import { DrizzleTodoCommentPurgeRepository } from "#api/modules/engagement/todo-comments/infrastructure/persistence/drizzle-todo-comment-purge.repository";
import { DrizzleTodoCommentRepository } from "#api/modules/engagement/todo-comments/infrastructure/persistence/drizzle-todo-comment.repository";
import { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";
import { todo, todoCategory, user } from "#api/platform/database/schema/index";
import {
  describeTodoCommentLikeRepositoryContract,
  LIKED_COMMENT_IDS,
} from "#test/contracts/engagement/todo-comment-like-repository.contract";
import { describeTodoCommentPurgeRepositoryContract } from "#test/contracts/engagement/todo-comment-purge-repository.contract";
import { describeTodoCommentRepositoryContract } from "#test/contracts/engagement/todo-comment-repository.contract";
import {
  createTodoCommentFixture,
  TODO_COMMENT_FIXTURE_FRIEND_ID,
  TODO_COMMENT_FIXTURE_OWNER_ID,
  TODO_COMMENT_FIXTURE_TODO_ID,
  TODO_COMMENT_FIXTURE_VIEWER_ID,
} from "#test/fixtures/engagement/todo-comment.fixture";
import { createUserRowFixture } from "#test/fixtures/identity/user-row.fixture";
import { nowInstant } from "#test/fixtures/platform/clock.fixture";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const CATEGORY_ID = 7101;
const TODO_IDS = [0, 1, 2].map((offset) => TODO_COMMENT_FIXTURE_TODO_ID + offset);

describe("Drizzle 댓글 저장소 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    await client.insert(user).values([
      createUserRowFixture({ id: TODO_COMMENT_FIXTURE_OWNER_ID }),
      createUserRowFixture({ id: TODO_COMMENT_FIXTURE_VIEWER_ID }),
      createUserRowFixture({ id: TODO_COMMENT_FIXTURE_FRIEND_ID }),
      createUserRowFixture({
        id: DELETED_COMMENT_AUTHOR.id,
        email: DELETED_COMMENT_AUTHOR.email,
        userTag: DELETED_COMMENT_AUTHOR.userTag,
        status: "LOCKED",
      }),
    ]);
    await client.insert(todoCategory).values({
      id: CATEGORY_ID,
      userId: TODO_COMMENT_FIXTURE_OWNER_ID,
      name: "댓글",
      color: "#123456",
      updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
    });
    await client.insert(todo).values(
      TODO_IDS.map((id) => ({
        id,
        userId: TODO_COMMENT_FIXTURE_OWNER_ID,
        categoryId: CATEGORY_ID,
        title: `댓글 할 일 ${id}`,
        startDate: Temporal.PlainDate.from("2026-08-26"),
        updatedAt: nowInstant(),
      })),
    );
  });

  afterAll(async () => {
    await database.stop();
  });

  function repositories() {
    const { transactionHost } = createDatabaseTransactionFixture(client);
    return {
      comments: new DrizzleTodoCommentRepository(transactionHost),
      likes: new DrizzleTodoCommentLikeRepository(transactionHost),
      purge: new DrizzleTodoCommentPurgeRepository(transactionHost),
    };
  }

  describeTodoCommentRepositoryContract(async () => repositories().comments);

  describeTodoCommentLikeRepositoryContract(async () => {
    const { comments, likes } = repositories();
    for (const id of LIKED_COMMENT_IDS) {
      await comments.save(createTodoCommentFixture({ id }));
    }
    return likes;
  });

  describeTodoCommentPurgeRepositoryContract(async () => repositories());

  it("시각은 ms 3자리 UTC로 저장하고 같은 Instant로 읽는다", async () => {
    // Given
    const { comments } = repositories();
    const createdAt = Temporal.Instant.from("2027-01-08T12:00:00.123Z");
    const comment = createTodoCommentFixture({ id: TodoCommentId.generate().value, createdAt });

    // When
    await comments.save(comment);
    const found = await comments.findByIdAndTodoId(
      comment.id,
      TodoId.reconstitute(TODO_COMMENT_FIXTURE_TODO_ID),
    );

    // Then
    expect(found?.toPrimitives().createdAt).toEqual(createdAt);
  });
});
