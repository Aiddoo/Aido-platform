import { ErrorCode } from "@aido/api/errors";
import { TODO_COMMENT_SORT } from "@aido/api/vocabulary";
import { vi } from "vitest";

import {
  createConversationRecordFixture,
  createEngagementCommentReader,
  StubEngagementCursorCodec,
} from "#test/fixtures/engagement-comment.fixture";
import { StubTodoCommentBlockReader } from "#test/mocks/ports/engagement-comment.stub";

import type { TodoConversationRecord } from "../../models/comments/todo-comment.types.js";
import { GetTodoConversation } from "./get-todo-conversation.use-case.js";

const TODO_ID = 1;
const VIEWER_ID = "cm1viewer0000000000000001";
const ROOT_ID = "cm1rootcomment000000000001";
const CHILD_ID = "cm1childcomment00000000001";

function createRecord(overrides: Partial<TodoConversationRecord> = {}): TodoConversationRecord {
  return createConversationRecordFixture({
    id: ROOT_ID,
    todoId: TODO_ID,
    authorId: "cm1author0000000000000001",
    todoOwnerId: "cm1owner00000000000000001",
    ...overrides,
  });
}

describe("GetTodoConversation", () => {
  it("페이지 경계 밖 같은 묶음 답글로 이어지는 lane과 양방향 cursor를 서버가 확정한다", async () => {
    // Given
    const reader = createEngagementCommentReader();
    const cursorCodec = new StubEngagementCursorCodec();
    const first = createRecord();
    const child = createRecord({
      id: CHILD_ID,
      threadCommentId: ROOT_ID,
      replyToCommentId: ROOT_ID,
    });
    reader.accessiblePairs.add(`${TODO_ID}:${VIEWER_ID}`);
    reader.conversationWindow = {
      items: [first, child],
      anchorIndex: null,
      previousRecord: createRecord({ id: "cm1previous000000000000001" }),
      nextRecord: createRecord({
        id: "cm1nextreply0000000000001",
        threadCommentId: ROOT_ID,
        replyToCommentId: CHILD_ID,
      }),
      hasPrevious: true,
      hasNext: true,
    };
    reader.likedCommentIds = new Set([CHILD_ID]);
    cursorCodec.encodedConversations = ["previous", "next"];
    const useCase = new GetTodoConversation({
      reader: reader,
      cursorCodec: cursorCodec,
      blockReader: new StubTodoCommentBlockReader(),
    });

    // When
    const response = await useCase.execute({
      todoId: TODO_ID,
      viewerId: VIEWER_ID,
      sort: TODO_COMMENT_SORT.LATEST,
      size: 2,
    });

    // Then
    expect(response.items[1]?.comment.viewer.isLiked).toBe(true);
    expect(response.items).toMatchObject([
      {
        comment: { id: ROOT_ID },
        connection: {
          visualDepth: 0,
          upperLaneDepths: [],
          lowerLaneDepths: [0],
          incomingBranch: null,
        },
        isFocused: false,
      },
      {
        comment: { id: CHILD_ID },
        connection: {
          visualDepth: 1,
          upperLaneDepths: [0],
          lowerLaneDepths: [0],
          incomingBranch: { fromDepth: 0, toDepth: 1 },
        },
        isFocused: false,
      },
    ]);
    expect(response.pagination).toMatchObject({
      hasPrevious: true,
      hasNext: true,
    });
    expect(response.pagination.previousCursor).not.toBeNull();
    expect(response.pagination.nextCursor).not.toBeNull();
  });

  it("답글에 단 답글도 같은 묶음의 1단계 답글로 머리 lane에 branch를 단다", async () => {
    // Given
    const reader = createEngagementCommentReader();
    const cursorCodec = new StubEngagementCursorCodec();
    const firstChild = createRecord({
      id: CHILD_ID,
      threadCommentId: ROOT_ID,
      replyToCommentId: ROOT_ID,
    });
    const sibling = createRecord({
      id: "cm1sibling0000000000000001",
      threadCommentId: ROOT_ID,
      replyToCommentId: CHILD_ID,
    });
    reader.accessiblePairs.add(`${TODO_ID}:${VIEWER_ID}`);
    reader.conversationWindow = {
      items: [firstChild, sibling],
      anchorIndex: null,
      previousRecord: null,
      nextRecord: null,
      hasPrevious: false,
      hasNext: false,
    };
    reader.likedCommentIds = new Set();
    const useCase = new GetTodoConversation({
      reader: reader,
      cursorCodec: cursorCodec,
      blockReader: new StubTodoCommentBlockReader(),
    });

    // When
    const response = await useCase.execute({
      todoId: TODO_ID,
      viewerId: VIEWER_ID,
      sort: TODO_COMMENT_SORT.LATEST,
      size: 2,
    });

    // Then
    expect(response.items).toMatchObject([
      {
        connection: {
          visualDepth: 1,
          upperLaneDepths: [0],
          lowerLaneDepths: [0],
          incomingBranch: { fromDepth: 0, toDepth: 1 },
        },
      },
      {
        connection: {
          visualDepth: 1,
          upperLaneDepths: [0],
          lowerLaneDepths: [],
          incomingBranch: { fromDepth: 0, toDepth: 1 },
        },
      },
    ]);
  });

  it("focus 답글 앞 페이지 밖의 묶음 머리를 한 번만 따로 싣는다", async () => {
    // Given
    const reader = createEngagementCommentReader();
    vi.spyOn(reader, "listConversation");
    vi.spyOn(reader, "findCommentRecords").mockResolvedValue([createRecord()]);
    const cursorCodec = new StubEngagementCursorCodec();
    const previousReply = createRecord({
      id: "cm1previousreply000000001",
      threadCommentId: ROOT_ID,
      replyToCommentId: ROOT_ID,
    });
    const focused = createRecord({
      id: CHILD_ID,
      threadCommentId: ROOT_ID,
      replyToCommentId: previousReply.id,
    });
    reader.accessiblePairs.add(`${TODO_ID}:${VIEWER_ID}`);
    reader.conversationWindow = {
      items: [previousReply, focused],
      anchorIndex: 1,
      previousRecord: null,
      nextRecord: null,
      hasPrevious: true,
      hasNext: false,
    };
    reader.likedCommentIds = new Set();
    const useCase = new GetTodoConversation({
      reader: reader,
      cursorCodec: cursorCodec,
      blockReader: new StubTodoCommentBlockReader(),
    });

    // When
    const response = await useCase.execute({
      todoId: TODO_ID,
      viewerId: VIEWER_ID,
      sort: TODO_COMMENT_SORT.LATEST,
      focusCommentId: CHILD_ID,
      size: 2,
    });

    // Then
    expect(response.focus).toMatchObject({
      commentId: CHILD_ID,
      itemIndex: 1,
      omittedAncestorCount: 0,
    });
    expect(response.focus?.precedingAncestors).toMatchObject([
      {
        comment: { id: ROOT_ID },
        connection: { visualDepth: 0, upperLaneDepths: [], lowerLaneDepths: [0] },
      },
    ]);
    expect(response.items[1]).toMatchObject({ comment: { id: CHILD_ID }, isFocused: true });
    expect(reader.listConversation).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "FOCUS", scope: "THREAD" }),
    );
    expect(reader.findCommentRecords).toHaveBeenCalledWith(TODO_ID, [ROOT_ID]);
  });

  it("다른 todo의 cursor는 reader를 호출하기 전에 거부한다", async () => {
    // Given
    const reader = createEngagementCommentReader();
    vi.spyOn(reader, "listConversation");

    const cursorCodec = new StubEngagementCursorCodec();
    reader.accessiblePairs.add(`${TODO_ID}:${VIEWER_ID}`);
    const useCase = new GetTodoConversation({
      reader: reader,
      cursorCodec: cursorCodec,
      blockReader: new StubTodoCommentBlockReader(),
    });
    const cursor = "other-todo-cursor";
    const anchor = createRecord({ todoId: 2 });
    cursorCodec.decodedConversation = {
      v: 1,
      kind: "conversation",
      sort: TODO_COMMENT_SORT.LATEST,
      todoId: anchor.todoId,
      commentId: anchor.id,
      threadId: anchor.id,
      scope: "TODO",
      position: anchor.conversationPosition,
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
    expect(reader.listConversation).not.toHaveBeenCalled();
  });

  it("cursor의 root rank snapshot을 reader boundary에 그대로 전달한다", async () => {
    // Given
    const reader = createEngagementCommentReader();
    vi.spyOn(reader, "listConversation");

    const cursorCodec = new StubEngagementCursorCodec();
    const anchor = createRecord({
      conversationPosition: { rootLikeCount: 7, rootReplyCount: 4 },
    });
    const cursor = "signed-cursor";
    cursorCodec.decodedConversation = {
      v: 1,
      kind: "conversation",
      sort: TODO_COMMENT_SORT.POPULAR,
      todoId: anchor.todoId,
      commentId: anchor.id,
      threadId: anchor.id,
      scope: "TODO",
      position: anchor.conversationPosition,
    };
    reader.accessiblePairs.add(`${TODO_ID}:${VIEWER_ID}`);
    reader.conversationWindow = {
      items: [anchor],
      anchorIndex: null,
      previousRecord: anchor,
      nextRecord: null,
      hasPrevious: true,
      hasNext: false,
    };
    reader.likedCommentIds = new Set();
    const useCase = new GetTodoConversation({
      reader: reader,
      cursorCodec: cursorCodec,
      blockReader: new StubTodoCommentBlockReader(),
    });

    await useCase.execute({
      todoId: TODO_ID,
      viewerId: VIEWER_ID,
      sort: TODO_COMMENT_SORT.POPULAR,
      after: cursor,
      size: 30,
    });

    // Then
    expect(reader.listConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "AFTER",
        scope: "TODO",
        anchorCommentId: anchor.id,
        anchorThreadId: anchor.id,
        anchorPosition: anchor.conversationPosition,
      }),
    );
  });

  it("없거나 tree에서 사라진 focus는 다른 root 대신 빈 대화로 복구한다", async () => {
    // Given
    const reader = createEngagementCommentReader();
    vi.spyOn(reader, "listConversation");
    vi.spyOn(reader, "findLikedCommentIds");

    const cursorCodec = new StubEngagementCursorCodec();
    reader.accessiblePairs.add(`${TODO_ID}:${VIEWER_ID}`);
    reader.conversationWindow = null;
    const useCase = new GetTodoConversation({
      reader: reader,
      cursorCodec: cursorCodec,
      blockReader: new StubTodoCommentBlockReader(),
    });

    // When
    await expect(
      useCase.execute({
        todoId: TODO_ID,
        viewerId: VIEWER_ID,
        sort: TODO_COMMENT_SORT.LATEST,
        focusCommentId: CHILD_ID,
        size: 30,
      }),
    ).resolves.toEqual({
      items: [],
      focus: null,
      pagination: {
        previousCursor: null,
        nextCursor: null,
        hasPrevious: false,
        hasNext: false,
        size: 30,
      },
    });

    // Then
    expect(reader.listConversation).toHaveBeenCalledTimes(1);
    expect(reader.findLikedCommentIds).not.toHaveBeenCalled();
  });

  it("삭제된 댓글로 열어도 묘비로 focus를 채운다", async () => {
    // Given
    const reader = createEngagementCommentReader();
    vi.spyOn(reader, "findCommentRecords");
    const cursorCodec = new StubEngagementCursorCodec();
    const deletedFocus = createRecord({
      id: CHILD_ID,
      threadCommentId: ROOT_ID,
      replyToCommentId: ROOT_ID,
      deletedAt: "2026-08-26T01:00:00.000Z",
      content: null,
      authorId: "cm1deletedcommentauthor000001",
      authorName: null,
    });
    reader.accessiblePairs.add(`${TODO_ID}:${VIEWER_ID}`);
    reader.conversationWindow = {
      items: [createRecord(), deletedFocus],
      anchorIndex: 1,
      previousRecord: null,
      nextRecord: null,
      hasPrevious: false,
      hasNext: false,
    };
    reader.likedCommentIds = new Set();
    const useCase = new GetTodoConversation({
      reader: reader,
      cursorCodec: cursorCodec,
      blockReader: new StubTodoCommentBlockReader(),
    });

    // When
    const response = await useCase.execute({
      todoId: TODO_ID,
      viewerId: VIEWER_ID,
      sort: TODO_COMMENT_SORT.LATEST,
      focusCommentId: CHILD_ID,
      size: 30,
    });

    // Then
    expect(response).toMatchObject({
      items: [
        { comment: { id: ROOT_ID } },
        { comment: { id: CHILD_ID, isDeleted: true, content: null }, isFocused: true },
      ],
      focus: { commentId: CHILD_ID, itemIndex: 1, precedingAncestors: [] },
    });
    expect(reader.findCommentRecords).not.toHaveBeenCalled();
  });
});
