import { TodoCommentIdempotencyRace } from "#api/modules/engagement/comments/application/comments.errors";
import type { TodoCommentRepositoryPort } from "#api/modules/engagement/comments/application/ports/todo-comment.repository.port";
import type {
  TodoComment,
  TodoCommentPrimitives,
} from "#api/modules/engagement/comments/domain/todo-comment.aggregate";
import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createTodoCommentFixture,
  TODO_COMMENT_FIXTURE_FRIEND_ID,
  TODO_COMMENT_FIXTURE_NOW,
  TODO_COMMENT_FIXTURE_OWNER_ID,
  TODO_COMMENT_FIXTURE_TODO_ID,
  TODO_COMMENT_FIXTURE_VIEWER_ID,
} from "#test/fixtures/engagement/todo-comment.fixture";

const LATER = TODO_COMMENT_FIXTURE_NOW.add({ minutes: 5 });
const OWNER = UserId.reconstitute(TODO_COMMENT_FIXTURE_OWNER_ID);
const VIEWER = UserId.reconstitute(TODO_COMMENT_FIXTURE_VIEWER_ID);

async function saveComment(
  repository: TodoCommentRepositoryPort,
  overrides: Partial<TodoCommentPrimitives> = {},
): Promise<TodoComment> {
  const comment = createTodoCommentFixture({ id: (await repository.nextId()).value, ...overrides });
  await repository.save(comment);
  return comment;
}

/** InMemory 저장소(unit)와 Drizzle 저장소(integration)가 같은 계약을 지키는지 확인한다 */
export function describeTodoCommentRepositoryContract(
  createRepository: () => Promise<TodoCommentRepositoryPort>,
): void {
  describe("댓글 저장소 계약", () => {
    it("nextId는 부를 때마다 다른 id를 준다", async () => {
      // Given
      const repository = await createRepository();

      // When
      const ids = [await repository.nextId(), await repository.nextId()];

      // Then
      expect(ids[0]?.equals(ids[1] ?? ids[0])).toBe(false);
    });

    it("저장한 글은 같은 할 일에서만 찾고 다른 할 일 id로는 찾지 못한다", async () => {
      // Given
      const repository = await createRepository();
      const comment = await saveComment(repository, { requestFingerprint: "a".repeat(64) });

      // When
      const found = await repository.findByIdAndTodoId(
        comment.id,
        TodoId.reconstitute(TODO_COMMENT_FIXTURE_TODO_ID),
      );
      const foreign = await repository.findByIdAndTodoId(
        comment.id,
        TodoId.reconstitute(TODO_COMMENT_FIXTURE_TODO_ID + 1),
      );

      // Then
      expect(found?.toPrimitives()).toEqual(comment.toPrimitives());
      expect(foreign).toBeNull();
    });

    it("다시 저장하면 원문·수·삭제·수정 시각을 덮어쓰고 작성자·위치·멱등 키·작성 시각은 둔다", async () => {
      // Given
      const repository = await createRepository();
      const head = await saveComment(repository);
      const changed = createTodoCommentFixture(head.toPrimitives());
      changed.edit(OWNER, "고친 내용", LATER);
      changed.addLike(LATER);
      changed.addReplies(2, LATER);
      changed.markDeleted({ actorId: OWNER, todoOwnerId: OWNER, now: LATER.add({ minutes: 1 }) });

      // When
      await repository.save(changed);
      const found = await repository.findByIdAndTodoId(
        head.id,
        TodoId.reconstitute(TODO_COMMENT_FIXTURE_TODO_ID),
      );

      // Then
      expect(found?.toPrimitives()).toEqual({
        ...head.toPrimitives(),
        content: null,
        likeCount: 0,
        replyCount: 2,
        deletedAt: LATER.add({ minutes: 1 }),
        editedAt: LATER,
        updatedAt: LATER.add({ minutes: 1 }),
      });
    });

    it("작성자와 멱등 키로 그 작성자의 글만 찾는다", async () => {
      // Given
      const repository = await createRepository();
      const mine = await saveComment(repository, { authorId: TODO_COMMENT_FIXTURE_VIEWER_ID });
      const other = await saveComment(repository, {
        authorId: TODO_COMMENT_FIXTURE_FRIEND_ID,
        clientRequestId: mine.clientRequestId,
      });

      // When
      const found = await repository.listByAuthorIdAndClientRequestIds(VIEWER, [
        mine.clientRequestId,
        other.clientRequestId,
      ]);
      const none = await repository.listByAuthorIdAndClientRequestIds(VIEWER, []);

      // Then
      expect(found.map((comment) => comment.id.value)).toEqual([mine.id.value]);
      expect(none).toEqual([]);
    });

    it("앞 글에 답하는 글을 한 번에 넣으면 모두 찾고, 멱등 키가 겹치면 하나도 넣지 않는다", async () => {
      // Given
      const repository = await createRepository();
      const head = createTodoCommentFixture({
        id: (await repository.nextId()).value,
        authorId: TODO_COMMENT_FIXTURE_VIEWER_ID,
        replyCount: 1,
      });
      const reply = createTodoCommentFixture({
        id: (await repository.nextId()).value,
        authorId: TODO_COMMENT_FIXTURE_VIEWER_ID,
        parentId: head.id.value,
        replyToCommentId: head.id.value,
        createdAt: TODO_COMMENT_FIXTURE_NOW.add({ milliseconds: 1 }),
      });
      const todoId = TodoId.reconstitute(TODO_COMMENT_FIXTURE_TODO_ID);

      const fresh = createTodoCommentFixture({
        id: (await repository.nextId()).value,
        authorId: TODO_COMMENT_FIXTURE_VIEWER_ID,
      });
      const replayed = createTodoCommentFixture({
        id: (await repository.nextId()).value,
        authorId: TODO_COMMENT_FIXTURE_VIEWER_ID,
        clientRequestId: head.clientRequestId,
      });

      // When
      await repository.insertMany([head, reply]);
      const duplicating = await repository.insertMany([fresh, replayed]).then(
        () => null,
        (error: unknown) => error,
      );

      // Then
      expect((await repository.findByIdAndTodoId(reply.id, todoId))?.toPrimitives()).toEqual(
        reply.toPrimitives(),
      );
      expect(duplicating).toBeInstanceOf(TodoCommentIdempotencyRace);
      expect(await repository.findByIdAndTodoId(fresh.id, todoId)).toBeNull();
    });

    it("같은 작성자가 같은 멱등 키로 새 글을 저장하면 경합 오류를 낸다", async () => {
      // Given
      const repository = await createRepository();
      const first = await saveComment(repository, { authorId: TODO_COMMENT_FIXTURE_VIEWER_ID });

      // When
      const duplicating = saveComment(repository, {
        authorId: TODO_COMMENT_FIXTURE_VIEWER_ID,
        clientRequestId: first.clientRequestId,
      });

      // Then
      await expect(duplicating).rejects.toBeInstanceOf(TodoCommentIdempotencyRace);
    });
  });
}
