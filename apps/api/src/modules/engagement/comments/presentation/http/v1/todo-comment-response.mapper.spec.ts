import {
  todoConversationItemSchema,
  type TodoComment,
  type TodoCommentOverviewResponse,
} from "@aido/api";

import {
  createCommentRecordFixture,
  createViewerContextFixture,
} from "#test/fixtures/engagement-comment.fixture";

import type { TodoCommentRecord } from "../../../application/read-models/todo-comment.read-model.js";
import {
  TodoCommentMapper,
  toTodoCommentResponse,
  toTodoConversationAncestorItems,
  toTodoConversationItems,
} from "./todo-comment-response.mapper.js";

const COMMENT_ID = "cm1rootcomment000000000001";
const REPLY_ID = "cm1replycomment00000000001";

describe("toTodoCommentResponse — 1.14.0 이하 앱 댓글 모양", () => {
  it("답글에 단 답글도 parentId는 묶음 머리, depth는 1이고 @대상은 replyTo에 남긴다", () => {
    // Given
    const record = createCommentRecordFixture({
      id: "cm1nestedreply00000000001",
      threadCommentId: COMMENT_ID,
      replyToCommentId: REPLY_ID,
      replyToAuthorName: "답글 작성자",
    });

    // When
    const response = toTodoCommentResponse(record, createViewerContextFixture());

    // Then
    expect(response).toMatchObject({
      threadId: COMMENT_ID,
      parentId: COMMENT_ID,
      depth: 1,
      replyTo: { commentId: REPLY_ID, authorName: "답글 작성자" },
    });
  });

  it("작성자 Aido ID가 없으면 v1 계약대로 userTag 키를 비운다", () => {
    // Given
    const record = createCommentRecordFixture({ authorUserTag: null });

    // When
    const response = toTodoCommentResponse(record, createViewerContextFixture());

    // Then
    expect(response).toMatchObject({ threadId: record.id, parentId: null, depth: 0 });
    expect(response.author?.userTag).toBeUndefined();
  });
});

const VIEWER_ID = "cmviewer00000000000000001";
const CONVERSATION_COMMENT_ID = "cm1todoacomment00000000001";
const OTHER_COMMENT_ID = "cm1todoacomment00000000009";

function createRecord(
  id: string,
  placement: { threadCommentId: string; replyToCommentId: string } | null = null,
): TodoCommentRecord {
  return {
    id,
    todoId: 1,
    threadCommentId: placement?.threadCommentId ?? null,
    replyToCommentId: placement?.replyToCommentId ?? null,
    replyToAuthorId: placement == null ? null : "cm1author0000000000000002",
    replyToAuthorName: placement == null ? null : "대상",
    authorId: "cm1author0000000000000001",
    authorName: "작성자",
    authorUserTag: null,
    authorProfileImage: null,
    todoOwnerId: "cm1owner00000000000000001",
    content: id,
    likeCount: 0,
    replyCount: 0,
    deletedAt: null,
    editedAt: null,
    createdAt: "2026-08-26T00:00:00.000Z",
  };
}

function toItems(records: TodoCommentRecord[], nextRecord: TodoCommentRecord | null = null) {
  return toTodoConversationItems({
    records,
    nextRecord,
    focusCommentId: null,
    viewer: createViewerContextFixture({ viewerId: VIEWER_ID }),
  });
}

describe("할 일 대화 응답 변환 (1.14.0 이하 앱)", () => {
  it("묶음 머리 lane이 마지막 답글까지 이어지고 답글마다 0→1 branch를 그린다", () => {
    // Given
    const comment = createRecord(CONVERSATION_COMMENT_ID);
    const firstReply = createRecord("cm1todoacomment00000000002", {
      threadCommentId: CONVERSATION_COMMENT_ID,
      replyToCommentId: CONVERSATION_COMMENT_ID,
    });
    const replyToReply = createRecord("cm1todoacomment00000000003", {
      threadCommentId: CONVERSATION_COMMENT_ID,
      replyToCommentId: firstReply.id,
    });
    const nextComment = createRecord(OTHER_COMMENT_ID);

    // When
    const items = toItems([comment, firstReply, replyToReply, nextComment]);

    // Then
    expect(items.map((item) => item.connection)).toEqual([
      { visualDepth: 0, upperLaneDepths: [], lowerLaneDepths: [0], incomingBranch: null },
      {
        visualDepth: 1,
        upperLaneDepths: [0],
        lowerLaneDepths: [0],
        incomingBranch: { fromDepth: 0, toDepth: 1 },
      },
      {
        visualDepth: 1,
        upperLaneDepths: [0],
        lowerLaneDepths: [],
        incomingBranch: { fromDepth: 0, toDepth: 1 },
      },
      { visualDepth: 0, upperLaneDepths: [], lowerLaneDepths: [], incomingBranch: null },
    ]);
    expect(items.map((item) => item.comment.depth)).toEqual([0, 1, 1, 0]);
    expect(items[2]?.comment).toMatchObject({
      parentId: CONVERSATION_COMMENT_ID,
      threadId: CONVERSATION_COMMENT_ID,
      replyTo: { commentId: firstReply.id, authorName: "대상" },
    });
    expect(items.every((item) => todoConversationItemSchema.safeParse(item).success)).toBe(true);
  });

  it("페이지 마지막 행도 경계 밖 다음 행이 같은 묶음이면 lane을 잇는다", () => {
    // Given
    const comment = createRecord(CONVERSATION_COMMENT_ID);
    const reply = createRecord("cm1todoacomment00000000002", {
      threadCommentId: CONVERSATION_COMMENT_ID,
      replyToCommentId: CONVERSATION_COMMENT_ID,
    });

    // When
    const [item] = toItems([comment], reply);

    // Then
    expect(item?.connection.lowerLaneDepths).toEqual([0]);
  });

  it("focus 앞에 따로 싣는 묶음 머리는 아래 lane만 연다", () => {
    // Given
    const comment = createRecord(CONVERSATION_COMMENT_ID);

    // When
    const items = toTodoConversationAncestorItems({
      records: [comment],
      viewer: createViewerContextFixture({ viewerId: VIEWER_ID }),
    });

    // Then
    expect(items.map((item) => item.connection)).toEqual([
      { visualDepth: 0, upperLaneDepths: [], lowerLaneDepths: [0], incomingBranch: null },
    ]);
  });
});

const createComment = (profileImage: string | null): TodoComment => ({
  id: "comment-1",
  threadId: "comment-1",
  parentId: null,
  depth: 0,
  author: { id: "user-1", name: "고양이", profileImage, isTodoOwner: true },
  content: "안녕",
  isDeleted: false,
  isEdited: false,
  likeCount: 0,
  replyCount: 1,
  replyTo: null,
  viewer: { isLiked: false, canEdit: true, canDelete: true, canReply: true },
  createdAt: "2026-10-03T00:00:00.000Z",
  editedAt: null,
});

describe("댓글 프로필 응답 매핑", () => {
  it("개요·답글·참여자를 변환해도 원본 프로필은 변경하지 않는다", () => {
    // Given
    const root = createComment("russian_blue");
    const reply = createComment("tuxedo_cat");
    const source: TodoCommentOverviewResponse = {
      items: [
        {
          comment: root,
          previewReply: reply,
          replySummary: {
            totalCount: 1,
            hiddenCount: 0,
            hasMore: false,
            participantAuthors: root.author ? [root.author] : [],
          },
        },
      ],
      pagination: {
        previousCursor: null,
        nextCursor: null,
        hasPrevious: false,
        hasNext: false,
        size: 20,
      },
    };

    // When
    const legacy = TodoCommentMapper.toOverview(source, "1.10.0");
    const latest = TodoCommentMapper.toOverview(source, "1.10.1");

    // Then
    expect(legacy.items[0]?.comment.author?.profileImage).toBe("scottish_fold");
    expect(legacy.items[0]?.previewReply?.author?.profileImage).toBe("black_cat");
    expect(legacy.items[0]?.replySummary.participantAuthors[0]?.profileImage).toBe("scottish_fold");
    expect(latest).toEqual(source);
    expect(root.author?.profileImage).toBe("russian_blue");
    expect(reply.author?.profileImage).toBe("tuxedo_cat");
  });

  it("삭제된 댓글의 빈 작성자 정보는 보존한다", () => {
    // Given
    const comment = { ...createComment(null), author: null, content: null, isDeleted: true };

    // When
    const result = TodoCommentMapper.toMutation({ comment });

    // Then
    expect(result.comment.author).toBeNull();
    expect(result.comment.content).toBeNull();
    expect(result.comment.isDeleted).toBe(true);
  });
});
