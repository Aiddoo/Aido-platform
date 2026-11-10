import { ErrorCode } from "@aido/api/errors";
import { vi } from "vitest";

import {
  createCommentRecordFixture,
  createEngagementCommentReader,
  StubEngagementCursorCodec,
} from "#test/fixtures/engagement-comment.fixture";
import { StubTodoCommentBlockReader } from "#test/mocks/ports/engagement-comment.stub";

import { GetTodoCommentReplies } from "./get-todo-comment-replies.use-case.js";

const TODO_ID = 1;
const VIEWER_ID = "cm1viewer0000000000000001";
const COMMENT_ID = "cm1rootcomment000000000001";
const REPLY_ID = "cm1replycomment00000000001";

function setup() {
  const reader = createEngagementCommentReader();
  const cursorCodec = new StubEngagementCursorCodec();
  reader.accessiblePairs.add(`${TODO_ID}:${VIEWER_ID}`);
  reader.likedCommentIds = new Set();
  vi.spyOn(reader, "findCommentRecord").mockResolvedValue(
    createCommentRecordFixture({ id: COMMENT_ID }),
  );
  reader.repliesWindow = {
    items: [
      createCommentRecordFixture({
        id: REPLY_ID,
        threadCommentId: COMMENT_ID,
        replyToCommentId: COMMENT_ID,
      }),
    ],
    hasPrevious: false,
    hasNext: true,
  };
  const useCase = new GetTodoCommentReplies({
    reader,
    cursorCodec,
    blockReader: new StubTodoCommentBlockReader(),
  });
  return { reader, cursorCodec, useCase };
}

const baseInput = { todoId: TODO_ID, viewerId: VIEWER_ID, threadCommentId: COMMENT_ID, size: 10 };

describe("GetTodoCommentReplies", () => {
  it("묶음 머리의 답글 첫 페이지와 다음 cursor를 돌려준다", async () => {
    // Given
    const { reader, useCase } = setup();
    const list = vi.spyOn(reader, "listReplies");

    // When
    const result = await useCase.execute(baseInput);

    // Then
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "INITIAL", threadCommentId: COMMENT_ID, size: 10 }),
    );
    expect(result.items.map((item) => item.id)).toEqual([REPLY_ID]);
    expect(result.pagination).toMatchObject({ hasNext: true, nextCursor: "previous" });
  });

  it("답글 ID로 묶음을 열면 TODO_0831로 거부한다", async () => {
    // Given
    const { reader, useCase } = setup();
    vi.spyOn(reader, "findCommentRecord").mockResolvedValue(
      createCommentRecordFixture({ id: REPLY_ID, threadCommentId: COMMENT_ID }),
    );

    // When
    const result = useCase.execute({ ...baseInput, threadCommentId: REPLY_ID });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0831 });
  });

  it("aroundReplyId가 지워졌거나 다른 묶음이면 첫 페이지로 복구한다", async () => {
    // Given
    const { reader, useCase } = setup();
    const window = reader.repliesWindow;
    const list = vi
      .spyOn(reader, "listReplies")
      .mockResolvedValueOnce(null)
      .mockResolvedValue(window);

    // When
    await useCase.execute({ ...baseInput, aroundReplyId: REPLY_ID });

    // Then
    expect(list.mock.calls.map((call) => call[0].mode)).toEqual(["AROUND", "INITIAL"]);
  });

  it("cursor의 방향을 쓰고 다른 묶음의 cursor는 거부한다", async () => {
    // Given
    const { reader, cursorCodec, useCase } = setup();
    const list = vi.spyOn(reader, "listReplies");
    cursorCodec.decodedReplies = {
      v: 1,
      kind: "replies",
      todoId: TODO_ID,
      threadCommentId: COMMENT_ID,
      replyId: REPLY_ID,
      direction: "BEFORE",
    };

    // When
    await useCase.execute({ ...baseInput, cursor: "signed" });
    cursorCodec.decodedReplies = { ...cursorCodec.decodedReplies, threadCommentId: REPLY_ID };
    const otherThread = useCase.execute({ ...baseInput, cursor: "other" });

    // Then
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "BEFORE", anchorReplyId: REPLY_ID }),
    );
    await expect(otherThread).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
  });
});
