import { ErrorCode } from "@aido/api/errors";
import { TODO_COMMENT_SORT } from "@aido/api/vocabulary";
import { vi } from "vitest";

import {
  createCommentRecordFixture,
  createEngagementCommentReader,
  StubEngagementCursorCodec,
} from "#test/fixtures/engagement-comment.fixture";
import { StubTodoCommentBlockReader } from "#test/mocks/ports/engagement-comment.stub";

import type {
  TodoCommentThreadItemRecord,
  TodoCommentThreadRecord,
} from "../../models/comments/todo-comment.types.js";
import { GetTodoCommentThreads } from "./get-todo-comment-threads.use-case.js";

const TODO_ID = 1;
const VIEWER_ID = "cm1viewer0000000000000001";
const COMMENT_ID = "cm1rootcomment000000000001";
const REPLY_ID = "cm1replycomment00000000001";
const PARTICIPANT_ID = "cm1participant00000000001";

function createThreadComment(
  overrides: Partial<TodoCommentThreadRecord> = {},
): TodoCommentThreadRecord {
  return {
    ...createCommentRecordFixture({ id: COMMENT_ID, todoId: TODO_ID, likeCount: 3, replyCount: 2 }),
    threadPosition: { rootLikeCount: 3, rootReplyCount: 2 },
    ...overrides,
  };
}

function createThreadItem(): TodoCommentThreadItemRecord {
  const comment = createThreadComment();
  return {
    comment,
    previewReply: createCommentRecordFixture({
      id: REPLY_ID,
      threadCommentId: COMMENT_ID,
      replyToCommentId: COMMENT_ID,
    }),
    totalCount: 2,
    participantAuthors: [
      { id: PARTICIPANT_ID, name: "참여자", userTag: null, profileImage: null, isTodoOwner: false },
    ],
  };
}

function setup() {
  const reader = createEngagementCommentReader();
  const cursorCodec = new StubEngagementCursorCodec();
  const blockReader = new StubTodoCommentBlockReader();
  reader.accessiblePairs.add(`${TODO_ID}:${VIEWER_ID}`);
  reader.likedCommentIds = new Set();
  reader.threadsWindow = { items: [createThreadItem()], hasPrevious: false, hasNext: false };
  const useCase = new GetTodoCommentThreads({ reader, cursorCodec, blockReader });
  return { reader, cursorCodec, blockReader, useCase };
}

const baseInput = {
  todoId: TODO_ID,
  viewerId: VIEWER_ID,
  sort: TODO_COMMENT_SORT.LATEST,
  size: 10,
} as const;

describe("GetTodoCommentThreads", () => {
  it("묶음 머리·대표 답글·참여자의 좋아요와 차단을 한 번씩 모으고 양방향 cursor를 만든다", async () => {
    // Given
    const { reader, blockReader, cursorCodec, useCase } = setup();
    const liked = vi.spyOn(reader, "findLikedCommentIds");
    const blocked = vi.spyOn(blockReader, "findBlockedCounterpartIds");
    const encode = vi.spyOn(cursorCodec, "encodeThreads");
    reader.threadsWindow = { items: [createThreadItem()], hasPrevious: true, hasNext: true };

    // When
    const result = await useCase.execute({ ...baseInput, page: { kind: "FIRST" } });

    // Then
    expect(result.items.map((item) => item.comment.id)).toEqual([COMMENT_ID]);
    expect(result.pagination).toEqual({
      previousCursor: "previous",
      nextCursor: "next",
      hasPrevious: true,
      hasNext: true,
      size: 10,
    });
    expect(result.anchor).toBeNull();
    expect(liked).toHaveBeenCalledWith([COMMENT_ID, REPLY_ID], VIEWER_ID);
    expect(blocked).toHaveBeenCalledWith(VIEWER_ID, expect.arrayContaining([PARTICIPANT_ID]));
    expect(encode.mock.calls.map((call) => call[2])).toEqual(["BEFORE", "AFTER"]);
  });

  it("답글로 anchor를 주면 그 묶음 머리가 든 페이지를 요청하고 위치를 돌려준다", async () => {
    // Given
    const { reader, useCase } = setup();
    vi.spyOn(reader, "findCommentRecord").mockResolvedValue(
      createCommentRecordFixture({ id: REPLY_ID, threadCommentId: COMMENT_ID }),
    );
    const list = vi.spyOn(reader, "listThreads");

    // When
    const result = await useCase.execute({
      ...baseInput,
      page: { kind: "ANCHOR", commentId: REPLY_ID },
    });

    // Then
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "ANCHOR", anchorCommentId: COMMENT_ID }),
    );
    expect(result.anchor).toEqual({ threadCommentId: COMMENT_ID, replyId: REPLY_ID });
  });

  it("anchor 묶음이 목록에 보이지 않으면 첫 페이지와 빈 anchor로 복구한다", async () => {
    // Given
    const { reader, useCase } = setup();
    vi.spyOn(reader, "findCommentRecord").mockResolvedValue(createCommentRecordFixture());
    const window = { items: [createThreadItem()], hasPrevious: false, hasNext: false };
    const list = vi
      .spyOn(reader, "listThreads")
      .mockResolvedValueOnce(null)
      .mockResolvedValue(window);

    // When
    const result = await useCase.execute({
      ...baseInput,
      page: { kind: "ANCHOR", commentId: COMMENT_ID },
    });

    // Then
    expect(list.mock.calls.map((call) => call[0].mode)).toEqual(["ANCHOR", "INITIAL"]);
    expect(result.anchor).toBeNull();
    expect(result.items).toHaveLength(1);
  });

  it("지운 글로 anchor를 주면 오류 없이 첫 페이지와 빈 anchor를 돌려준다", async () => {
    // Given
    const { reader, useCase } = setup();
    vi.spyOn(reader, "findCommentRecord").mockResolvedValue(
      createCommentRecordFixture({
        id: REPLY_ID,
        threadCommentId: COMMENT_ID,
        deletedAt: "2026-08-26T01:00:00.000Z",
      }),
    );
    const list = vi.spyOn(reader, "listThreads");

    // When
    const result = await useCase.execute({
      ...baseInput,
      page: { kind: "ANCHOR", commentId: REPLY_ID },
    });

    // Then
    expect(list.mock.calls.map((call) => call[0].mode)).toEqual(["INITIAL"]);
    expect(result.anchor).toBeNull();
  });

  it("v2 cursor는 담긴 방향과 인기순 위치를 reader 경계에 그대로 전달한다", async () => {
    // Given
    const { reader, cursorCodec, useCase } = setup();
    const list = vi.spyOn(reader, "listThreads");
    cursorCodec.decodedThreads = {
      v: 1,
      kind: "overview",
      sort: TODO_COMMENT_SORT.POPULAR,
      todoId: TODO_ID,
      rootId: COMMENT_ID,
      position: { rootLikeCount: 9, rootReplyCount: 5 },
      direction: "BEFORE",
    };

    // When
    await useCase.execute({
      ...baseInput,
      sort: TODO_COMMENT_SORT.POPULAR,
      page: { kind: "CURSOR", cursor: "signed" },
    });

    // Then
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "BEFORE",
        anchorCommentId: COMMENT_ID,
        anchorPosition: { rootLikeCount: 9, rootReplyCount: 5 },
      }),
    );
  });

  it("방향이 없는 1.14.0 이하 앱 cursor도 v1 after로 읽는다", async () => {
    // Given
    const { reader, cursorCodec, useCase } = setup();
    const list = vi.spyOn(reader, "listThreads");
    cursorCodec.decodedThreads = {
      v: 1,
      kind: "overview",
      sort: TODO_COMMENT_SORT.LATEST,
      todoId: TODO_ID,
      rootId: COMMENT_ID,
      position: { rootLikeCount: 0, rootReplyCount: 0 },
    };

    // When
    await useCase.execute({
      ...baseInput,
      page: { kind: "CURSOR", cursor: "legacy", direction: "AFTER" },
    });

    // Then
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ mode: "AFTER" }));
  });

  it("다른 할 일의 cursor와 접근할 수 없는 할 일은 reader 호출 전에 거부한다", async () => {
    // Given
    const { reader, cursorCodec, useCase } = setup();
    const list = vi.spyOn(reader, "listThreads");
    cursorCodec.decodedThreads = {
      v: 1,
      kind: "overview",
      sort: TODO_COMMENT_SORT.LATEST,
      todoId: 2,
      rootId: COMMENT_ID,
      position: { rootLikeCount: 0, rootReplyCount: 0 },
    };

    // When
    const otherTodo = useCase.execute({ ...baseInput, page: { kind: "CURSOR", cursor: "other" } });
    const forbidden = useCase.execute({
      ...baseInput,
      viewerId: "cm1stranger00000000000001",
      page: { kind: "FIRST" },
    });

    // Then
    await expect(otherTodo).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
    await expect(forbidden).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
    expect(list).not.toHaveBeenCalled();
  });
});
