import type { TodoCommentLikeRepositoryPort } from "#api/modules/engagement/comments/application/ports/todo-comment-like.repository.port";
import type { TodoCommentPurgeRepositoryPort } from "#api/modules/engagement/comments/application/ports/todo-comment-purge.repository.port";
import type { TodoCommentRepositoryPort } from "#api/modules/engagement/comments/application/ports/todo-comment.repository.port";
import { DELETED_COMMENT_AUTHOR } from "#api/modules/engagement/comments/domain/comments.constants";
import type { TodoCommentPrimitives } from "#api/modules/engagement/comments/domain/todo-comment.aggregate";
import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createTodoCommentFixture,
  createTodoCommentLikeFixture,
  TODO_COMMENT_FIXTURE_FRIEND_ID,
  TODO_COMMENT_FIXTURE_NOW,
  TODO_COMMENT_FIXTURE_OWNER_ID,
  TODO_COMMENT_FIXTURE_TODO_ID,
  TODO_COMMENT_FIXTURE_VIEWER_ID,
} from "#test/fixtures/engagement/todo-comment.fixture";

export interface TodoCommentPurgeRepositories {
  readonly comments: TodoCommentRepositoryPort;
  readonly likes: TodoCommentLikeRepositoryPort;
  readonly purge: TodoCommentPurgeRepositoryPort;
}

const TODO_ID = TODO_COMMENT_FIXTURE_TODO_ID;
const OTHER_TODO_ID = TODO_COMMENT_FIXTURE_TODO_ID + 1;
const PURGED = UserId.reconstitute(TODO_COMMENT_FIXTURE_VIEWER_ID);
const PURGED_AT = TODO_COMMENT_FIXTURE_NOW.add({ hours: 1 });

const IDS = {
  head: "cm1purgehead0000000000001",
  purgedReply: "cm1purgereply000000000001",
  friendReply: "cm1purgefriendreply000001",
  likedOnly: "cm1purgelikedonly00000001",
  untouched: "cm1purgeuntouched00000001",
} as const;

async function seed(repositories: TodoCommentPurgeRepositories): Promise<void> {
  const save = (overrides: Partial<TodoCommentPrimitives>) =>
    repositories.comments.save(createTodoCommentFixture(overrides));
  await save({
    id: IDS.head,
    authorId: TODO_COMMENT_FIXTURE_FRIEND_ID,
    replyCount: 2,
    likeCount: 1,
  });
  await save({
    id: IDS.purgedReply,
    authorId: TODO_COMMENT_FIXTURE_VIEWER_ID,
    parentId: IDS.head,
    replyToCommentId: IDS.head,
    requestFingerprint: "b".repeat(64),
    likeCount: 1,
  });
  await save({
    id: IDS.friendReply,
    authorId: TODO_COMMENT_FIXTURE_FRIEND_ID,
    parentId: IDS.head,
    replyToCommentId: IDS.purgedReply,
  });
  await save({ id: IDS.likedOnly, todoId: OTHER_TODO_ID, authorId: TODO_COMMENT_FIXTURE_OWNER_ID });
  await save({
    id: IDS.untouched,
    todoId: OTHER_TODO_ID + 1,
    authorId: TODO_COMMENT_FIXTURE_OWNER_ID,
  });
  await repositories.likes.save(createTodoCommentLikeFixture({ commentId: IDS.head }));
  await repositories.likes.save(
    createTodoCommentLikeFixture({ commentId: IDS.likedOnly, isActive: false }),
  );
  await repositories.likes.save(
    createTodoCommentLikeFixture({
      commentId: IDS.purgedReply,
      userId: TODO_COMMENT_FIXTURE_FRIEND_ID,
    }),
  );
}

/** 계정 정리 저장소 계약. 할 일 id 1·2·3과 세 사용자, 지운 댓글 작성자가 있어야 한다 */
export function describeTodoCommentPurgeRepositoryContract(
  createRepositories: () => Promise<TodoCommentPurgeRepositories>,
): void {
  describe("댓글 계정 정리 저장소 계약", () => {
    it("사용자가 쓰거나 좋아요한 글의 할 일과 그 할 일의 모든 글을 오름차순으로 계획한다", async () => {
      // Given
      const repositories = await createRepositories();
      await seed(repositories);

      // When
      const plan = await repositories.purge.planPurge(PURGED);

      // Then
      expect(plan).toEqual({
        affectedTodoIds: [TODO_ID, OTHER_TODO_ID],
        commentIdsToLock: [IDS.head, IDS.purgedReply, IDS.friendReply, IDS.likedOnly].toSorted(),
      });
    });

    it("좋아요를 지우고 쓴 글을 묘비로 넘긴 뒤 좋아요·답글 수와 할 일 댓글 수를 다시 센다", async () => {
      // Given
      const repositories = await createRepositories();
      await seed(repositories);
      const plan = await repositories.purge.planPurge(PURGED);

      // When
      const counts = await repositories.purge.purge(PURGED, plan, PURGED_AT);

      // Then
      const find = (id: string, todoId = TODO_ID) =>
        repositories.comments.findByIdAndTodoId(
          createTodoCommentFixture({ id }).id,
          TodoId.reconstitute(todoId),
        );
      const purgedReply = (await find(IDS.purgedReply))?.toPrimitives();
      expect(counts).toEqual([
        { todoId: TODO_ID, commentCount: 2 },
        { todoId: OTHER_TODO_ID, commentCount: 1 },
      ]);
      expect(purgedReply).toMatchObject({
        authorId: DELETED_COMMENT_AUTHOR.id,
        content: null,
        likeCount: 0,
        requestFingerprint: null,
        deletedAt: PURGED_AT,
      });
      expect(purgedReply?.clientRequestId).not.toBe(
        createTodoCommentFixture({ id: IDS.purgedReply }).clientRequestId,
      );
      expect([(await find(IDS.head))?.likeCount, (await find(IDS.head))?.replyCount]).toEqual([
        0, 1,
      ]);
      expect(
        await repositories.likes.findByCommentIdAndUserId(
          createTodoCommentFixture({ id: IDS.likedOnly }).id,
          PURGED,
        ),
      ).toBeNull();
      expect((await find(IDS.untouched, OTHER_TODO_ID + 1))?.content).toBe("댓글 원문");
    });

    it("정리할 할 일이 없으면 아무것도 바꾸지 않고 빈 수를 돌려준다", async () => {
      // Given
      const repositories = await createRepositories();

      // When
      const plan = await repositories.purge.planPurge(PURGED);
      const counts = await repositories.purge.purge(PURGED, plan, PURGED_AT);

      // Then
      expect({ plan, counts }).toEqual({
        plan: { affectedTodoIds: [], commentIdsToLock: [] },
        counts: [],
      });
    });
  });
}
