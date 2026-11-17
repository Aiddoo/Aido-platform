import { todoConversationItemSchema } from "@aido/api/contracts/todo-comment";

import {
  createTodoCommentReadModelFixture,
  createTodoCommentViewerFixture,
} from "#test/fixtures/engagement/todo-comment.fixture";

import type { TodoCommentReadModel } from "../../../application/read-models/todo-comment.read-model.js";
import {
  toTodoCommentOverviewResponse,
  toTodoCommentResponse,
  toTodoConversationAncestorItems,
  toTodoConversationItems,
} from "./todo-comment-response.mapper.js";

const COMMENT_ID = "cm1rootcomment000000000001";
const REPLY_ID = "cm1replycomment00000000001";

describe("toTodoCommentResponse — 1.14.0 이하 앱 댓글 모양", () => {
  it("답글에 단 답글도 parentId는 묶음 머리, depth는 1이고 @대상은 replyTo에 남긴다", () => {
    // Given
    const readModel = createTodoCommentReadModelFixture({
      id: "cm1nestedreply00000000001",
      threadCommentId: COMMENT_ID,
      replyToCommentId: REPLY_ID,
      replyToAuthorName: "답글 작성자",
    });

    // When
    const response = toTodoCommentResponse(readModel, createTodoCommentViewerFixture());

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
    const readModel = createTodoCommentReadModelFixture({ authorUserTag: null });

    // When
    const response = toTodoCommentResponse(readModel, createTodoCommentViewerFixture());

    // Then
    expect(response).toMatchObject({ threadId: readModel.id, parentId: null, depth: 0 });
    expect(response.author?.userTag).toBeUndefined();
  });
});

const VIEWER_ID = "cmviewer00000000000000001";
const CONVERSATION_COMMENT_ID = "cm1todoacomment00000000001";
const OTHER_COMMENT_ID = "cm1todoacomment00000000009";

function createReadModel(
  id: string,
  placement: { threadCommentId: string; replyToCommentId: string } | null = null,
): TodoCommentReadModel {
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
    createdAt: Temporal.Instant.from("2026-08-26T00:00:00.000Z"),
  };
}

function toItems(
  comments: TodoCommentReadModel[],
  nextComment: TodoCommentReadModel | null = null,
) {
  return toTodoConversationItems({
    comments,
    nextComment,
    focusCommentId: null,
    viewer: createTodoCommentViewerFixture({ viewerId: VIEWER_ID }),
  });
}

describe("할 일 대화 응답 변환 (1.14.0 이하 앱)", () => {
  it("묶음 머리 lane이 마지막 답글까지 이어지고 답글마다 0→1 branch를 그린다", () => {
    // Given
    const comment = createReadModel(CONVERSATION_COMMENT_ID);
    const firstReply = createReadModel("cm1todoacomment00000000002", {
      threadCommentId: CONVERSATION_COMMENT_ID,
      replyToCommentId: CONVERSATION_COMMENT_ID,
    });
    const replyToReply = createReadModel("cm1todoacomment00000000003", {
      threadCommentId: CONVERSATION_COMMENT_ID,
      replyToCommentId: firstReply.id,
    });
    const nextComment = createReadModel(OTHER_COMMENT_ID);

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
    const comment = createReadModel(CONVERSATION_COMMENT_ID);
    const reply = createReadModel("cm1todoacomment00000000002", {
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
    const comment = createReadModel(CONVERSATION_COMMENT_ID);

    // When
    const items = toTodoConversationAncestorItems({
      comments: [comment],
      viewer: createTodoCommentViewerFixture({ viewerId: VIEWER_ID }),
    });

    // Then
    expect(items.map((item) => item.connection)).toEqual([
      { visualDepth: 0, upperLaneDepths: [], lowerLaneDepths: [0], incomingBranch: null },
    ]);
  });
});

describe("댓글 프로필 응답 매핑", () => {
  it("1.10.1보다 낮은 앱에는 작성자·대표 답글·참여자의 새 프로필을 옛 프로필로 바꿔 준다", () => {
    // Given
    const head = createTodoCommentReadModelFixture({ authorProfileImage: "russian_blue" });
    const reply = createTodoCommentReadModelFixture({
      id: "cm1replycomment00000000001",
      threadCommentId: head.id,
      replyToCommentId: head.id,
      authorProfileImage: "tuxedo_cat",
    });
    const page = {
      items: [
        {
          comment: { ...head, threadPosition: { rootLikeCount: 0, rootReplyCount: 1 } },
          previewReply: reply,
          totalCount: 1,
          participantAuthors: [
            {
              id: head.authorId,
              name: "고양이",
              userTag: null,
              profileImage: "russian_blue",
              isTodoOwner: true,
            },
          ],
        },
      ],
      viewer: createTodoCommentViewerFixture(),
      pagination: {
        previousCursor: null,
        nextCursor: null,
        hasPrevious: false,
        hasNext: false,
        size: 20,
      },
      anchor: null,
    };

    // When
    const legacy = toTodoCommentOverviewResponse(page, "1.10.0");
    const latest = toTodoCommentOverviewResponse(page, "1.10.1");

    // Then
    expect([
      legacy.items[0]?.comment.author?.profileImage,
      legacy.items[0]?.previewReply?.author?.profileImage,
      legacy.items[0]?.replySummary.participantAuthors[0]?.profileImage,
    ]).toEqual(["scottish_fold", "black_cat", "scottish_fold"]);
    expect(latest.items[0]?.comment.author?.profileImage).toBe("russian_blue");
  });
});
