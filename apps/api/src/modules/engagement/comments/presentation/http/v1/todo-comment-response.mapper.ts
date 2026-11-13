import type {
  TodoComment,
  TodoCommentAuthor,
  TodoCommentChainResponse,
  TodoCommentLikeResponse,
  TodoCommentMutationResponse,
  TodoCommentOverviewResponse,
  TodoCommentV2Author,
  TodoConversationConnection,
  TodoConversationItem,
  TodoConversationResponse,
  TodoDetailsResponse,
} from "@aido/api/contracts/todo-comment";

import { toFriendTodoResponse } from "#api/modules/planning/todos/planning-todos.public";
import { resolveProfileImage } from "#api/platform/http/profile/profile-image.resolver";

import type {
  TodoCommentLikeState,
  TodoCommentReadModel,
  TodoCommentsWithViewer,
  TodoCommentThreadsPage,
  TodoCommentWithViewer,
  TodoCommentViewer,
  TodoConversationPage,
  TodoDetailsReadModel,
} from "../../../application/read-models/todo-comment.read-model.js";
import { getTodoDetailsPermissions } from "../../../domain/todo-comment-permission.domain-service.js";
import {
  toTodoCommentCursorPagination,
  toTodoCommentV2,
  toVisibleParticipantAuthors,
  toVisiblePreviewReply,
} from "../v2/todo-comment-response.mapper.js";

/** v1 작성자는 userTag가 optional이라 값이 없으면 키를 뺀다 */
function toTodoCommentAuthorResponse(author: TodoCommentV2Author): TodoCommentAuthor {
  return {
    id: author.id,
    name: author.name,
    userTag: author.userTag ?? undefined,
    profileImage: author.profileImage,
    isTodoOwner: author.isTodoOwner,
  };
}

/** 1.14.0 이하 앱은 parentId·depth로 들여쓰기를 그린다. 2단계라 parentId는 묶음 머리다 */
export function toTodoCommentResponse(
  comment: TodoCommentReadModel,
  viewer: TodoCommentViewer,
  appVersion?: string,
): TodoComment {
  const v2Comment = toTodoCommentV2(comment, viewer, appVersion);
  return {
    id: v2Comment.id,
    threadId: v2Comment.threadCommentId ?? v2Comment.id,
    parentId: v2Comment.threadCommentId,
    depth: v2Comment.threadCommentId == null ? 0 : 1,
    author: v2Comment.author == null ? null : toTodoCommentAuthorResponse(v2Comment.author),
    content: v2Comment.content,
    isDeleted: v2Comment.isDeleted,
    isAuthorBlocked: v2Comment.isAuthorBlocked,
    isEdited: v2Comment.isEdited,
    likeCount: v2Comment.likeCount,
    replyCount: v2Comment.replyCount,
    replyTo: v2Comment.replyTo,
    viewer: v2Comment.viewer,
    createdAt: v2Comment.createdAt,
    editedAt: v2Comment.editedAt,
  };
}

export function toTodoCommentOverviewResponse(
  page: TodoCommentThreadsPage,
  appVersion?: string,
): TodoCommentOverviewResponse {
  return {
    items: page.items.map((item) => {
      const previewReply = toVisiblePreviewReply(item, page.viewer);
      const hiddenCount = Math.max(0, item.totalCount - (previewReply == null ? 0 : 1));
      return {
        comment: toTodoCommentResponse(item.comment, page.viewer, appVersion),
        // 차단한 작성자의 대표 답글도 1.14.0 이하 앱에는 가린 묘비로 그대로 싣는다
        previewReply:
          item.previewReply == null
            ? null
            : toTodoCommentResponse(item.previewReply, page.viewer, appVersion),
        replySummary: {
          totalCount: item.totalCount,
          hiddenCount,
          hasMore: hiddenCount > 0,
          participantAuthors: toVisibleParticipantAuthors(item, page.viewer, appVersion).map(
            toTodoCommentAuthorResponse,
          ),
        },
      };
    }),
    pagination: toTodoCommentCursorPagination(page.pagination),
  };
}

function toVisualDepth(comment: TodoCommentReadModel): 0 | 1 {
  return comment.threadCommentId == null ? 0 : 1;
}

/**
 * 1.14.0 이하 앱은 이 topology를 그대로 그린다. 묶음은 2단계라 lane은 묶음 머리의 0 하나뿐이고,
 * 다음 행이 같은 묶음의 답글이면 lane이 이어진다.
 */
function toConversationConnection(
  comment: TodoCommentReadModel,
  next: TodoCommentReadModel | null | undefined,
): TodoConversationConnection {
  const visualDepth = toVisualDepth(comment);
  const threadCommentId = comment.threadCommentId ?? comment.id;
  const continuesThread = next?.threadCommentId === threadCommentId;
  return {
    visualDepth,
    upperLaneDepths: visualDepth === 0 ? [] : [0],
    lowerLaneDepths: continuesThread ? [0] : [],
    incomingBranch: visualDepth === 0 ? null : { fromDepth: 0, toDepth: 1 },
  };
}

export function toTodoConversationItems(params: {
  readonly comments: readonly TodoCommentReadModel[];
  readonly nextComment: TodoCommentReadModel | null;
  readonly focusCommentId: string | null;
  readonly viewer: TodoCommentViewer;
  readonly appVersion?: string;
}): TodoConversationItem[] {
  return params.comments.map((comment, index) => ({
    comment: toTodoCommentResponse(comment, params.viewer, params.appVersion),
    connection: toConversationConnection(
      comment,
      index === params.comments.length - 1 ? params.nextComment : params.comments[index + 1],
    ),
    isFocused: comment.id === params.focusCommentId,
  }));
}

/** focus 답글 앞에 따로 싣는 묶음 머리. 아래 lane만 열어 focus 쪽으로 이어진다 */
export function toTodoConversationAncestorItems(params: {
  readonly comments: readonly TodoCommentReadModel[];
  readonly viewer: TodoCommentViewer;
  readonly appVersion?: string;
}): TodoConversationItem[] {
  return params.comments.map((comment) => ({
    comment: toTodoCommentResponse(comment, params.viewer, params.appVersion),
    connection: { visualDepth: 0, upperLaneDepths: [], lowerLaneDepths: [0], incomingBranch: null },
    isFocused: false,
  }));
}

export function toTodoConversationResponse(
  page: TodoConversationPage,
  appVersion?: string,
): TodoConversationResponse {
  return {
    items: toTodoConversationItems({
      comments: page.items,
      nextComment: page.nextItem,
      focusCommentId: page.focus?.commentId ?? null,
      viewer: page.viewer,
      appVersion,
    }),
    focus:
      page.focus == null
        ? null
        : {
            commentId: page.focus.commentId,
            itemIndex: page.focus.itemIndex,
            precedingAncestors: toTodoConversationAncestorItems({
              comments: page.focus.precedingThreadComments,
              viewer: page.viewer,
              appVersion,
            }),
            omittedAncestorCount: 0,
          },
    pagination: toTodoCommentCursorPagination(page.pagination),
  };
}

export function toTodoCommentChainResponse(
  written: TodoCommentsWithViewer,
  appVersion?: string,
): TodoCommentChainResponse {
  return {
    comments: written.comments.map((comment) =>
      toTodoCommentResponse(comment, written.viewer, appVersion),
    ),
  };
}

export function toTodoCommentMutationResponse(
  updated: TodoCommentWithViewer,
  appVersion?: string,
): TodoCommentMutationResponse {
  return { comment: toTodoCommentResponse(updated.comment, updated.viewer, appVersion) };
}

export function toTodoCommentLikeResponse(state: TodoCommentLikeState): TodoCommentLikeResponse {
  return { commentId: state.commentId, isLiked: state.isLiked, likeCount: state.likeCount };
}

export function toTodoDetailsResponse(
  details: TodoDetailsReadModel,
  appVersion?: string,
): TodoDetailsResponse {
  return {
    todo: toFriendTodoResponse(details.todo),
    owner: {
      id: details.owner.id,
      name: details.owner.name,
      profileImage: resolveProfileImage(details.owner.profileImage, appVersion),
    },
    permissions: getTodoDetailsPermissions(details.isOwner),
    metrics: { viewCount: details.viewCount, commentCount: details.commentCount },
  };
}
