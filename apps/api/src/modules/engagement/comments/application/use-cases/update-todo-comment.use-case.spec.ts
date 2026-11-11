import { ErrorCode } from "@aido/api/errors";

import { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import {
  createTodoCommentLikeFixture,
  TODO_COMMENT_FIXTURE_FRIEND_ID,
  TODO_COMMENT_FIXTURE_TODO_ID,
  TODO_COMMENT_FIXTURE_VIEWER_ID,
} from "#test/fixtures/engagement/todo-comment.fixture";
import {
  createTodoCommentsFixture,
  type TodoCommentsFixture,
} from "#test/fixtures/engagement/todo-comments.fixture";

import { UpdateTodoCommentUseCase } from "./update-todo-comment.use-case.js";

const TODO_ID = TODO_COMMENT_FIXTURE_TODO_ID;

describe("UpdateTodoCommentUseCase — 댓글 수정", () => {
  let fixture: TodoCommentsFixture;

  beforeEach(() => {
    fixture = createTodoCommentsFixture();
  });

  it("작성자는 글을 고치고 수정 시각을 남기며 작성 시각과 내 좋아요를 그대로 돌려준다", async () => {
    // Given
    const comment = await fixture.addComment({ authorId: TODO_COMMENT_FIXTURE_VIEWER_ID });
    await fixture.likeRepository.save(
      createTodoCommentLikeFixture({ commentId: comment.id.value }),
    );

    // When
    const result = await new UpdateTodoCommentUseCase(fixture).execute({
      todoId: TODO_ID,
      commentId: comment.id.value,
      userId: TODO_COMMENT_FIXTURE_VIEWER_ID,
      content: "  수정 내용 ",
    });

    // Then
    expect(result.comment).toMatchObject({
      content: "수정 내용",
      editedAt: fixture.clock.now(),
      createdAt: comment.toPrimitives().createdAt,
    });
    expect(result.viewer.likedCommentIds).toEqual(new Set([comment.id.value]));
  });

  it("같은 내용으로 고쳐도 수정 시각을 남긴다", async () => {
    // Given
    const comment = await fixture.addComment({ authorId: TODO_COMMENT_FIXTURE_VIEWER_ID });

    // When
    const result = await new UpdateTodoCommentUseCase(fixture).execute({
      todoId: TODO_ID,
      commentId: comment.id.value,
      userId: TODO_COMMENT_FIXTURE_VIEWER_ID,
      content: "댓글 원문",
    });

    // Then
    expect(result.comment.editedAt).toEqual(fixture.clock.now());
  });

  it("남의 글을 고치면 내용 검증보다 먼저 TODO_0832로 거부하고 원문을 둔다", async () => {
    // Given
    const comment = await fixture.addComment({ authorId: TODO_COMMENT_FIXTURE_FRIEND_ID });

    // When
    const updating = new UpdateTodoCommentUseCase(fixture).execute({
      todoId: TODO_ID,
      commentId: comment.id.value,
      userId: TODO_COMMENT_FIXTURE_VIEWER_ID,
      content: "   ",
    });

    // Then
    await expect(updating).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0832 });
    expect(
      (await fixture.repository.findByIdAndTodoId(comment.id, TodoId.reconstitute(TODO_ID)))
        ?.content,
    ).toBe("댓글 원문");
  });

  it("할 일을 볼 수 없으면 글이 없어도 TODO_0801을 먼저 낸다", async () => {
    // Given
    fixture.reader.revokeAccess(TODO_ID, TODO_COMMENT_FIXTURE_VIEWER_ID);

    // When
    const updating = new UpdateTodoCommentUseCase(fixture).execute({
      todoId: TODO_ID,
      commentId: "cm1missingcomment00000001",
      userId: TODO_COMMENT_FIXTURE_VIEWER_ID,
      content: "수정",
    });

    // Then
    await expect(updating).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
  });
});
