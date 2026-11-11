import type {
  TodoComment,
  TodoCommentPrimitives,
} from "#api/modules/engagement/comments/domain/todo-comment.aggregate";
import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import { FakeTodoCommentReader } from "#test/doubles/engagement/fake-todo-comment.reader";
import { FakeTodoEngagementCounter } from "#test/doubles/engagement/fake-todo-engagement-counter";
import { InMemoryTodoCommentLikeRepository } from "#test/doubles/engagement/in-memory-todo-comment-like.repository";
import { InMemoryTodoCommentPurgeRepository } from "#test/doubles/engagement/in-memory-todo-comment-purge.repository";
import { InMemoryTodoCommentRepository } from "#test/doubles/engagement/in-memory-todo-comment.repository";
import { RecordingTodoCommentNotification } from "#test/doubles/engagement/recording-todo-comment-notification";
import { RecordingTodoViewCacheInvalidator } from "#test/doubles/engagement/recording-todo-view-cache-invalidator";
import { StubTodoCommentBlockReader } from "#test/doubles/engagement/stub-todo-comment-block-reader";
import { StubTodoCommentCursorCodec } from "#test/doubles/engagement/stub-todo-comment-cursor-codec";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";

import {
  createTodoCommentFixture,
  TODO_COMMENT_FIXTURE_FRIEND_ID,
  TODO_COMMENT_FIXTURE_NOW,
  TODO_COMMENT_FIXTURE_OWNER_ID,
  TODO_COMMENT_FIXTURE_TODO_ID,
  TODO_COMMENT_FIXTURE_VIEWER_ID,
} from "./todo-comment.fixture.js";

/** 댓글 UseCase를 InMemory 저장소와 기록용 대역으로 조립하는 의존성 묶음 */
export function createTodoCommentsFixture() {
  const repository = new InMemoryTodoCommentRepository();
  const likeRepository = new InMemoryTodoCommentLikeRepository();
  const reader = new FakeTodoCommentReader(repository, likeRepository);
  reader.grantAccess(TODO_COMMENT_FIXTURE_TODO_ID, TODO_COMMENT_FIXTURE_OWNER_ID, [
    TODO_COMMENT_FIXTURE_VIEWER_ID,
    TODO_COMMENT_FIXTURE_FRIEND_ID,
  ]);
  reader.names.set(TODO_COMMENT_FIXTURE_OWNER_ID, "작성자");
  reader.names.set(TODO_COMMENT_FIXTURE_VIEWER_ID, "방문자");
  const engagementCounter = new FakeTodoEngagementCounter();
  let commentSequence = 0;

  async function addComment(overrides: Partial<TodoCommentPrimitives> = {}): Promise<TodoComment> {
    commentSequence += 1;
    const comment = createTodoCommentFixture({
      id: `cm1seeded${String(commentSequence).padStart(16, "0")}`,
      createdAt: TODO_COMMENT_FIXTURE_NOW.add({ seconds: commentSequence }),
      ...overrides,
    });
    await repository.save(comment);
    await engagementCounter.increaseCommentCount(TodoId.reconstitute(comment.todoId), 1);
    return comment;
  }

  return {
    repository,
    likeRepository,
    purgeRepository: new InMemoryTodoCommentPurgeRepository(repository, likeRepository),
    reader,
    engagementCounter,
    notification: new RecordingTodoCommentNotification(),
    blockReader: new StubTodoCommentBlockReader(),
    cursorCodec: new StubTodoCommentCursorCodec(),
    todoViewCache: new RecordingTodoViewCacheInvalidator(),
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock: new RecordingMutationLock(),
    clock: new FixedClock(TODO_COMMENT_FIXTURE_NOW.add({ hours: 1 })),
    logger: new SilentLogger(),
    addComment,
  };
}

export type TodoCommentsFixture = ReturnType<typeof createTodoCommentsFixture>;
