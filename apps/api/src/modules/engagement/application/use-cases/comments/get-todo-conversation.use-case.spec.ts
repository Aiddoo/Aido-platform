import { ErrorCode } from "@aido/api/errors";
import { TODO_COMMENT_SORT } from "@aido/api/vocabulary";
import { vi } from "vitest";

import {
  createConversationRecordFixture,
  createEngagementCommentReader,
  StubEngagementCursorCodec,
} from "#test/fixtures/engagement-comment.fixture";

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
  it("페이지 경계 밖 자식으로 내려가는 lane과 양방향 cursor를 서버가 확정한다", async () => {
    // Given
    const reader = createEngagementCommentReader();
    const cursorCodec = new StubEngagementCursorCodec();
    const first = createRecord();
    const child = createRecord({
      id: CHILD_ID,
      parentId: ROOT_ID,
      rootId: ROOT_ID,
      path: [ROOT_ID],
      depth: 1,
    });
    reader.accessiblePairs.add(`${TODO_ID}:${VIEWER_ID}`);
    reader.conversationWindow = {
      items: [first, child],
      anchorIndex: null,
      previousRecord: createRecord({ id: "cm1previous000000000000001" }),
      nextRecord: createRecord({
        id: "cm1nextreply0000000000001",
        parentId: CHILD_ID,
        rootId: ROOT_ID,
      }),
      hasPrevious: true,
      hasNext: true,
    };
    reader.likedCommentIds = new Set([CHILD_ID]);
    cursorCodec.encodedConversations = ["previous", "next"];
    const useCase = new GetTodoConversation({ reader: reader, cursorCodec: cursorCodec });

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
          lowerLaneDepths: [1],
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

  it("인접 형제를 직접 잇지 않고 부모 lane에 각각 branch로 연결한다", async () => {
    // Given
    const reader = createEngagementCommentReader();
    const cursorCodec = new StubEngagementCursorCodec();
    const firstChild = createRecord({
      id: CHILD_ID,
      parentId: ROOT_ID,
      rootId: ROOT_ID,
      path: [ROOT_ID],
      depth: 1,
      continuingAncestorDepths: [0],
    });
    const sibling = createRecord({
      id: "cm1sibling0000000000000001",
      parentId: ROOT_ID,
      rootId: ROOT_ID,
      path: [ROOT_ID],
      depth: 1,
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
    const useCase = new GetTodoConversation({ reader: reader, cursorCodec: cursorCodec });

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

  it("focus는 현재 window index와 잘린 조상 문맥을 한 번만 싣는다", async () => {
    // Given
    const reader = createEngagementCommentReader();
    vi.spyOn(reader, "listConversation");
    vi.spyOn(reader, "findAncestors");

    const cursorCodec = new StubEngagementCursorCodec();
    const ancestors = Array.from({ length: 20 }, (_, index) => {
      const id = `cm1ancestor${String(index).padStart(15, "0")}`;
      return createRecord({
        id,
        parentId:
          index === 0
            ? "cm1omittedancestor000000002"
            : `cm1ancestor${String(index - 1).padStart(15, "0")}`,
        rootId: ROOT_ID,
        depth: index + 2,
      });
    });
    const allAncestorIds = [
      "cm1omittedancestor000000001",
      "cm1omittedancestor000000002",
      ...ancestors.map((ancestor) => ancestor.id),
    ];
    const focused = createRecord({
      id: CHILD_ID,
      parentId: ancestors.at(-1)?.id ?? ROOT_ID,
      rootId: ROOT_ID,
      path: allAncestorIds,
      depth: allAncestorIds.length,
    });
    reader.accessiblePairs.add(`${TODO_ID}:${VIEWER_ID}`);
    reader.conversationWindow = {
      items: [createRecord(), focused],
      anchorIndex: 1,
      previousRecord: null,
      nextRecord: null,
      hasPrevious: false,
      hasNext: false,
    };
    reader.ancestors = ancestors;
    reader.likedCommentIds = new Set();
    const useCase = new GetTodoConversation({ reader: reader, cursorCodec: cursorCodec });

    // When
    const response = await useCase.execute({
      todoId: TODO_ID,
      viewerId: VIEWER_ID,
      sort: TODO_COMMENT_SORT.LATEST,
      focusCommentId: CHILD_ID,
      size: 30,
    });

    // Then
    expect(response.focus).toMatchObject({
      commentId: CHILD_ID,
      itemIndex: 1,
      omittedAncestorCount: 2,
    });
    expect(response.focus?.precedingAncestors).toHaveLength(20);
    expect(response.focus?.precedingAncestors.at(-1)).toMatchObject({
      connection: {
        visualDepth: 21,
        upperLaneDepths: [20],
        lowerLaneDepths: [21],
        incomingBranch: { fromDepth: 20, toDepth: 21 },
      },
      isFocused: false,
    });
    expect(response.items[1]).toMatchObject({
      comment: { id: CHILD_ID },
      isFocused: true,
    });
    expect(reader.listConversation).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "FOCUS", scope: "THREAD" }),
    );
    expect(reader.findAncestors).toHaveBeenCalledWith(TODO_ID, allAncestorIds.slice(-20));
  });

  it("다른 todo의 cursor는 reader를 호출하기 전에 거부한다", async () => {
    // Given
    const reader = createEngagementCommentReader();
    vi.spyOn(reader, "listConversation");

    const cursorCodec = new StubEngagementCursorCodec();
    reader.accessiblePairs.add(`${TODO_ID}:${VIEWER_ID}`);
    const useCase = new GetTodoConversation({ reader: reader, cursorCodec: cursorCodec });
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
    const useCase = new GetTodoConversation({ reader: reader, cursorCodec: cursorCodec });

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
    const useCase = new GetTodoConversation({ reader: reader, cursorCodec: cursorCodec });

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

  it("후손 때문에 보존된 삭제 댓글은 같은 thread만 돌려주고 focus 표시는 하지 않는다", async () => {
    // Given
    const reader = createEngagementCommentReader();
    vi.spyOn(reader, "listConversation");
    vi.spyOn(reader, "findAncestors");

    const cursorCodec = new StubEngagementCursorCodec();
    const deletedFocus = createRecord({
      id: CHILD_ID,
      parentId: ROOT_ID,
      rootId: ROOT_ID,
      path: [ROOT_ID],
      depth: 1,
      deletedAt: "2026-08-26T01:00:00.000Z",
      content: null,
      authorId: "cm1deletedcommentauthor000001",
      authorName: null,
      replyCount: 1,
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
    const useCase = new GetTodoConversation({ reader: reader, cursorCodec: cursorCodec });

    // When
    await expect(
      useCase.execute({
        todoId: TODO_ID,
        viewerId: VIEWER_ID,
        sort: TODO_COMMENT_SORT.LATEST,
        focusCommentId: CHILD_ID,
        size: 30,
      }),
    ).resolves.toMatchObject({
      items: [
        { comment: { id: ROOT_ID } },
        { comment: { id: CHILD_ID, isDeleted: true }, isFocused: false },
      ],
      focus: null,
    });

    // Then
    expect(reader.findAncestors).not.toHaveBeenCalled();
    expect(reader.listConversation).toHaveBeenCalledTimes(1);
  });
});
