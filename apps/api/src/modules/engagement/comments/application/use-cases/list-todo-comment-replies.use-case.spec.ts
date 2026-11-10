import { ErrorCode } from "@aido/api/errors";

import {
  createTodoCommentReadModelFixture,
  TODO_COMMENT_FIXTURE_TODO_ID,
  TODO_COMMENT_FIXTURE_VIEWER_ID,
} from "#test/fixtures/engagement/todo-comment.fixture";
import {
  createTodoCommentsFixture,
  type TodoCommentsFixture,
} from "#test/fixtures/engagement/todo-comments.fixture";

import { TodoCommentId } from "../../domain/todo-comment-id.vo.js";
import { ListTodoCommentRepliesUseCase } from "./list-todo-comment-replies.use-case.js";

const TODO_ID = TODO_COMMENT_FIXTURE_TODO_ID;
const HEAD_ID = "cm1rootcomment000000000001";
const REPLY_ID = "cm1replycomment00000000001";

describe("ListTodoCommentRepliesUseCase — 묶음의 답글 목록", () => {
  let fixture: TodoCommentsFixture;
  const query = {
    todoId: TODO_ID,
    viewerId: TODO_COMMENT_FIXTURE_VIEWER_ID,
    threadCommentId: HEAD_ID,
    size: 2,
  };

  beforeEach(async () => {
    fixture = createTodoCommentsFixture();
    await fixture.addComment({ id: HEAD_ID, replyCount: 1 });
    await fixture.addComment({ id: REPLY_ID, parentId: HEAD_ID, replyToCommentId: HEAD_ID });
    fixture.reader.repliesWindow = {
      items: [
        createTodoCommentReadModelFixture({
          id: REPLY_ID,
          threadCommentId: HEAD_ID,
          replyToCommentId: HEAD_ID,
        }),
      ],
      hasPrevious: false,
      hasNext: true,
    };
  });

  it("묶음 머리의 답글 첫 페이지와 다음 cursor를 돌려준다", async () => {
    // When
    const page = await new ListTodoCommentRepliesUseCase(fixture).execute(query);

    // Then
    expect(page.items.map((item) => item.id)).toEqual([REPLY_ID]);
    expect(page.pagination).toEqual({
      previousCursor: null,
      nextCursor: `replies:AFTER:${REPLY_ID}`,
      hasPrevious: false,
      hasNext: true,
      size: 2,
    });
  });

  it("답글 id로 묶음을 열면 TODO_0831로 거부한다", async () => {
    // When
    const listing = new ListTodoCommentRepliesUseCase(fixture).execute({
      ...query,
      threadCommentId: REPLY_ID,
    });

    // Then
    await expect(listing).rejects.toMatchObject({
      errorCode: ErrorCode.TODO_0831,
      details: { commentId: REPLY_ID },
    });
  });

  it("aroundReplyId를 찾지 못하면 첫 페이지로 연다", async () => {
    // Given
    fixture.reader.isAnchorMissing = true;

    // When
    await new ListTodoCommentRepliesUseCase(fixture).execute({
      ...query,
      aroundReplyId: "cm1missingreply0000000001",
    });

    // Then
    expect(fixture.reader.replyParams.map((params) => params.mode)).toEqual(["AROUND", "INITIAL"]);
  });

  it("cursor에 담긴 방향으로 읽고 다른 묶음의 cursor는 SYS_0002로 거부한다", async () => {
    // Given
    fixture.cursorCodec.register("before", {
      todoId: TODO_ID,
      threadCommentId: HEAD_ID,
      replyId: REPLY_ID,
      direction: "BEFORE",
    });
    fixture.cursorCodec.register("other-thread", {
      todoId: TODO_ID,
      threadCommentId: REPLY_ID,
      replyId: REPLY_ID,
      direction: "AFTER",
    });
    const useCase = new ListTodoCommentRepliesUseCase(fixture);

    // When
    await useCase.execute({ ...query, cursor: "before" });
    const foreign = useCase.execute({ ...query, cursor: "other-thread" });

    // Then
    expect(fixture.reader.replyParams.at(0)).toMatchObject({
      mode: "BEFORE",
      anchorReplyId: TodoCommentId.reconstitute(REPLY_ID),
    });
    await expect(foreign).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
  });
});
