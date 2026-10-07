import { ErrorCode } from "@aido/api/errors";
import { TODO_COMMENT_SORT } from "@aido/api/vocabulary";
import { vi } from "vitest";

import {
  createCommentRecordFixture,
  createEngagementCommentReader,
  StubEngagementCursorCodec,
} from "#test/fixtures/engagement-comment.fixture";

import type {
  TodoCommentOverviewItemRecord,
  TodoCommentOverviewRootRecord,
} from "../../models/comments/todo-comment.types.js";
import { GetTodoCommentOverview } from "./get-todo-comment-overview.use-case.js";

const TODO_ID = 1;
const VIEWER_ID = "cm1viewer0000000000000001";
const ROOT_ID = "cm1rootcomment000000000001";
const REPLY_ID = "cm1replycomment00000000001";

function createRoot(
  overrides: Partial<TodoCommentOverviewRootRecord> = {},
): TodoCommentOverviewRootRecord {
  return {
    ...createCommentRecordFixture({
      id: ROOT_ID,
      todoId: TODO_ID,
      authorId: "cm1author0000000000000001",
      todoOwnerId: "cm1owner00000000000000001",
      content: "원문",
      likeCount: 3,
      replyCount: 1,
    }),
    overviewPosition: { rootLikeCount: 3, rootReplyCount: 1 },
    ...overrides,
  };
}

function createOverviewItem(): TodoCommentOverviewItemRecord {
  const comment = createRoot();
  return {
    comment,
    previewReply: {
      ...comment,
      id: REPLY_ID,
      parentId: ROOT_ID,
      rootId: ROOT_ID,
      path: [ROOT_ID],
      depth: 1,
      parentAuthorName: comment.authorName,
      content: "미리보기",
    },
    totalCount: 4,
    participantAuthors: [
      {
        id: comment.todoOwnerId,
        name: "할 일 주인",
        profileImage: null,
        isTodoOwner: true,
      },
    ],
  };
}

describe("GetTodoCommentOverview", () => {
  it("root와 preview를 projection하고 숨은 답글 수와 cursor를 서버가 확정한다", async () => {
    // Given
    const reader = createEngagementCommentReader();
    vi.spyOn(reader, "findLikedCommentIds");

    const cursorCodec = new StubEngagementCursorCodec();
    const item = createOverviewItem();
    reader.accessiblePairs.add(`${TODO_ID}:${VIEWER_ID}`);
    reader.overviewWindow = {
      items: [item],
      previousRecord: createRoot({ id: "cm1previousroot00000000001" }),
      nextRecord: createRoot({ id: "cm1nextroot000000000000001" }),
      hasPrevious: true,
      hasNext: true,
    };
    reader.likedCommentIds = new Set([REPLY_ID]);
    cursorCodec.encodedOverviews = ["previous", "next"];
    const useCase = new GetTodoCommentOverview({ reader: reader, cursorCodec: cursorCodec });

    // When
    const response = await useCase.execute({
      todoId: TODO_ID,
      viewerId: VIEWER_ID,
      sort: TODO_COMMENT_SORT.LATEST,
      size: 10,
    });

    // Then
    expect(response.items[0]).toMatchObject({
      comment: { id: ROOT_ID },
      previewReply: { id: REPLY_ID, viewer: { isLiked: true } },
      replySummary: {
        totalCount: 4,
        hiddenCount: 3,
        hasMore: true,
        participantAuthors: [{ isTodoOwner: true }],
      },
    });
    expect(response.pagination).toMatchObject({ hasPrevious: true, hasNext: true, size: 10 });
    expect(response.pagination.previousCursor).not.toBeNull();
    expect(response.pagination.nextCursor).not.toBeNull();
    expect(reader.findLikedCommentIds).toHaveBeenCalledWith([ROOT_ID, REPLY_ID], VIEWER_ID);
  });

  it("답글이 없으면 preview와 숨은 수를 비운다", async () => {
    // Given
    // Given
    const reader = createEngagementCommentReader();
    vi.spyOn(reader, "findLikedCommentIds");

    const cursorCodec = new StubEngagementCursorCodec();
    const item = createOverviewItem();
    item.previewReply = null;
    item.totalCount = 0;
    reader.accessiblePairs.add(`${TODO_ID}:${VIEWER_ID}`);
    reader.overviewWindow = {
      items: [item],
      previousRecord: null,
      nextRecord: null,
      hasPrevious: false,
      hasNext: false,
    };
    reader.likedCommentIds = new Set();
    const useCase = new GetTodoCommentOverview({ reader: reader, cursorCodec: cursorCodec });

    // When
    // When
    const response = await useCase.execute({
      todoId: TODO_ID,
      viewerId: VIEWER_ID,
      sort: TODO_COMMENT_SORT.LATEST,
      size: 10,
    });

    // Then
    // Then
    expect(response.items[0]).toMatchObject({
      previewReply: null,
      replySummary: { totalCount: 0, hiddenCount: 0, hasMore: false },
    });
    expect(reader.findLikedCommentIds).toHaveBeenCalledWith([ROOT_ID], VIEWER_ID);
  });

  it("접근할 수 없는 할 일은 목록 조회 전에 거부한다", async () => {
    // Given
    // Given
    const reader = createEngagementCommentReader();
    vi.spyOn(reader, "listOverview");

    const cursorCodec = new StubEngagementCursorCodec();
    reader.accessiblePairs.delete(`${TODO_ID}:${VIEWER_ID}`);
    const useCase = new GetTodoCommentOverview({ reader: reader, cursorCodec: cursorCodec });

    // When
    const result = useCase.execute({
      todoId: TODO_ID,
      viewerId: VIEWER_ID,
      sort: TODO_COMMENT_SORT.LATEST,
      size: 10,
    });

    // Then
    // When
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
    // Then
    expect(reader.listOverview).not.toHaveBeenCalled();
  });

  it("POPULAR cursor rank snapshot을 overview reader 경계에 그대로 전달한다", async () => {
    // Given
    const reader = createEngagementCommentReader();
    vi.spyOn(reader, "listOverview");

    const cursorCodec = new StubEngagementCursorCodec();
    const root = createRoot({ overviewPosition: { rootLikeCount: 9, rootReplyCount: 5 } });
    const cursor = "signed-cursor";
    cursorCodec.decodedOverview = {
      v: 1,
      kind: "overview",
      sort: TODO_COMMENT_SORT.POPULAR,
      todoId: root.todoId,
      rootId: root.id,
      position: root.overviewPosition,
    };
    reader.accessiblePairs.add(`${TODO_ID}:${VIEWER_ID}`);
    reader.overviewWindow = {
      items: [],
      previousRecord: root,
      nextRecord: null,
      hasPrevious: false,
      hasNext: false,
    };
    reader.likedCommentIds = new Set();
    const useCase = new GetTodoCommentOverview({ reader: reader, cursorCodec: cursorCodec });

    await useCase.execute({
      todoId: TODO_ID,
      viewerId: VIEWER_ID,
      sort: TODO_COMMENT_SORT.POPULAR,
      after: cursor,
      size: 30,
    });

    // Then
    expect(reader.listOverview).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "AFTER",
        anchorRootId: root.id,
        anchorPosition: root.overviewPosition,
      }),
    );
  });

  it("다른 todo의 cursor는 reader 호출 전에 거부한다", async () => {
    // Given
    const reader = createEngagementCommentReader();
    vi.spyOn(reader, "listOverview");

    const cursorCodec = new StubEngagementCursorCodec();
    reader.accessiblePairs.add(`${TODO_ID}:${VIEWER_ID}`);
    const useCase = new GetTodoCommentOverview({ reader: reader, cursorCodec: cursorCodec });
    const cursor = "other-todo-cursor";
    const root = createRoot({ todoId: 2 });
    cursorCodec.decodedOverview = {
      v: 1,
      kind: "overview",
      sort: TODO_COMMENT_SORT.LATEST,
      todoId: root.todoId,
      rootId: root.id,
      position: root.overviewPosition,
    };

    // When
    await expect(
      useCase.execute({
        todoId: TODO_ID,
        viewerId: VIEWER_ID,
        sort: TODO_COMMENT_SORT.LATEST,
        after: cursor,
        size: 30,
      }),
    ).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
    // Then
    expect(reader.listOverview).not.toHaveBeenCalled();
  });
});
