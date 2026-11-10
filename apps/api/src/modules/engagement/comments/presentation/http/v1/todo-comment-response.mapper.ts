import type {
  TodoComment,
  TodoCommentAuthor,
  TodoCommentChainResponse,
  TodoCommentMutationResponse,
  TodoCommentOverviewResponse,
  TodoCommentV2Author,
  TodoConversationConnection,
  TodoConversationItem,
  TodoConversationResponse,
  TodoDetailsResponse,
} from "@aido/api";

import { resolveProfileImage } from "#api/platform/http/profile/profile-image.resolver";

import type {
  TodoCommentRecord,
  TodoCommentThreadsResult,
  TodoCommentViewerContext,
} from "../../../application/read-models/todo-comment.read-model.js";
import {
  toTodoCommentParticipantAuthor,
  toTodoCommentView,
  toVisiblePreviewReply,
} from "../v2/todo-comment-response.mapper.js";

/** v1 작성자는 userTag가 optional이라 값이 없으면 키를 뺀다. */
export function toTodoCommentAuthorResponse(author: TodoCommentV2Author): TodoCommentAuthor {
  return {
    id: author.id,
    name: author.name,
    userTag: author.userTag ?? undefined,
    profileImage: author.profileImage,
    isTodoOwner: author.isTodoOwner,
  };
}

/** 1.14.0 이하 앱은 parentId·depth로 들여쓰기를 그린다. 2단계라 parentId는 묶음 머리다. */
export function toTodoCommentResponse(
  record: TodoCommentRecord,
  viewer: TodoCommentViewerContext,
): TodoComment {
  const view = toTodoCommentView(record, viewer);

  return {
    id: view.id,
    threadId: view.threadCommentId ?? view.id,
    parentId: view.threadCommentId,
    depth: view.threadCommentId == null ? 0 : 1,
    author: view.author == null ? null : toTodoCommentAuthorResponse(view.author),
    content: view.content,
    isDeleted: view.isDeleted,
    isAuthorBlocked: view.isAuthorBlocked,
    isEdited: view.isEdited,
    likeCount: view.likeCount,
    replyCount: view.replyCount,
    replyTo: view.replyTo,
    viewer: view.viewer,
    createdAt: view.createdAt,
    editedAt: view.editedAt,
  };
}

export function toTodoCommentOverviewResponse(
  result: TodoCommentThreadsResult,
): TodoCommentOverviewResponse {
  return {
    items: result.items.map((item) => {
      const previewReply = toVisiblePreviewReply(item, result.viewer);
      const hiddenCount = Math.max(0, item.totalCount - (previewReply == null ? 0 : 1));

      return {
        comment: toTodoCommentResponse(item.comment, result.viewer),
        previewReply:
          item.previewReply == null
            ? null
            : toTodoCommentResponse(item.previewReply, result.viewer),
        replySummary: {
          totalCount: item.totalCount,
          hiddenCount,
          hasMore: hiddenCount > 0,
          participantAuthors: item.participantAuthors
            .filter((author) => !result.viewer.blockedAuthorIds.has(author.id))
            .map((author) => toTodoCommentAuthorResponse(toTodoCommentParticipantAuthor(author))),
        },
      };
    }),
    pagination: result.pagination,
  };
}

function toVisualDepth(record: TodoCommentRecord): 0 | 1 {
  return record.threadCommentId == null ? 0 : 1;
}

/**
 * 1.14.0 이하 앱은 이 topology를 그대로 그린다. 묶음은 2단계라 lane은 묶음 머리의 0 하나뿐이고,
 * 다음 행이 같은 묶음의 답글이면 lane이 이어진다.
 */
function toConversationConnection(
  record: TodoCommentRecord,
  nextRecord: TodoCommentRecord | null | undefined,
): TodoConversationConnection {
  const visualDepth = toVisualDepth(record);
  const threadCommentId = record.threadCommentId ?? record.id;
  const continuesThread = nextRecord?.threadCommentId === threadCommentId;

  return {
    visualDepth,
    upperLaneDepths: visualDepth === 0 ? [] : [0],
    lowerLaneDepths: continuesThread ? [0] : [],
    incomingBranch: visualDepth === 0 ? null : { fromDepth: 0, toDepth: 1 },
  };
}

export function toTodoConversationItems(input: {
  records: readonly TodoCommentRecord[];
  nextRecord: TodoCommentRecord | null;
  focusCommentId: string | null;
  viewer: TodoCommentViewerContext;
}): TodoConversationItem[] {
  return input.records.map((record, index) => ({
    comment: toTodoCommentResponse(record, input.viewer),
    connection: toConversationConnection(
      record,
      index === input.records.length - 1 ? input.nextRecord : input.records[index + 1],
    ),
    isFocused: record.id === input.focusCommentId,
  }));
}

/** focus 답글 앞에 따로 싣는 묶음 머리. 아래 lane만 열어 focus 쪽으로 이어진다. */
export function toTodoConversationAncestorItems(input: {
  records: readonly TodoCommentRecord[];
  viewer: TodoCommentViewerContext;
}): TodoConversationItem[] {
  return input.records.map((record) => ({
    comment: toTodoCommentResponse(record, input.viewer),
    connection: {
      visualDepth: 0,
      upperLaneDepths: [],
      lowerLaneDepths: [0],
      incomingBranch: null,
    },
    isFocused: false,
  }));
}

const toComment = (comment: TodoComment, appVersion?: string): TodoComment => ({
  ...comment,
  author: comment.author && {
    ...comment.author,
    profileImage: resolveProfileImage(comment.author.profileImage, appVersion),
  },
});

export const TodoCommentMapper = {
  toDetails: (result: TodoDetailsResponse, appVersion?: string): TodoDetailsResponse => ({
    ...result,
    owner: {
      ...result.owner,
      profileImage: resolveProfileImage(result.owner.profileImage, appVersion),
    },
  }),
  toOverview: (
    result: TodoCommentOverviewResponse,
    appVersion?: string,
  ): TodoCommentOverviewResponse => ({
    ...result,
    items: result.items.map((item) => ({
      ...item,
      comment: toComment(item.comment, appVersion),
      previewReply: item.previewReply && toComment(item.previewReply, appVersion),
      replySummary: {
        ...item.replySummary,
        participantAuthors: item.replySummary.participantAuthors.map((author) => ({
          ...author,
          profileImage: resolveProfileImage(author.profileImage, appVersion),
        })),
      },
    })),
  }),
  toConversation: (
    result: TodoConversationResponse,
    appVersion?: string,
  ): TodoConversationResponse => ({
    ...result,
    items: result.items.map((item) => ({ ...item, comment: toComment(item.comment, appVersion) })),
    focus: result.focus && {
      ...result.focus,
      precedingAncestors: result.focus.precedingAncestors.map((item) => ({
        ...item,
        comment: toComment(item.comment, appVersion),
      })),
    },
  }),
  toChain: (result: TodoCommentChainResponse, appVersion?: string): TodoCommentChainResponse => ({
    ...result,
    comments: result.comments.map((comment) => toComment(comment, appVersion)),
  }),
  toMutation: (
    result: TodoCommentMutationResponse,
    appVersion?: string,
  ): TodoCommentMutationResponse => ({
    ...result,
    comment: toComment(result.comment, appVersion),
  }),
};
