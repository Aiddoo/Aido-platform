import type {
  TodoCommentCursorPagination,
  TodoCommentRepliesResponse,
  TodoCommentThreadsResponse,
  TodoCommentV2,
  TodoCommentV2Author,
} from "@aido/api/contracts/todo-comment";

import { resolveProfileImage } from "#api/platform/http/profile/profile-image.resolver";
import { toIsoString } from "#api/shared/domain/time/instant";

import type {
  TodoCommentCursorPage,
  TodoCommentParticipantAuthorReadModel,
  TodoCommentReadModel,
  TodoCommentRepliesPage,
  TodoCommentThreadItemReadModel,
  TodoCommentThreadsPage,
  TodoCommentViewer,
} from "../../../application/read-models/todo-comment.read-model.js";
import { getTodoCommentViewerPermissions } from "../../../domain/todo-comment-permission.domain-service.js";

/**
 * v1·v2가 함께 쓰는 댓글 표현. 보는 사람과 차단 관계인 작성자의 글은 위치만 남기고 지운 글처럼 가린다.
 * isAuthorBlocked를 모르는 구 앱도 지운 댓글로 그려 차단한 사람의 이름·내용이 보이지 않는다.
 */
export function toTodoCommentV2(
  comment: TodoCommentReadModel,
  viewer: TodoCommentViewer,
  appVersion?: string,
): TodoCommentV2 {
  const isAuthorBlocked = viewer.blockedAuthorIds.has(comment.authorId);
  const isHidden = comment.deletedAt != null || isAuthorBlocked;
  const isReplyTargetAuthorBlocked =
    comment.replyToAuthorId != null && viewer.blockedAuthorIds.has(comment.replyToAuthorId);

  return {
    id: comment.id,
    todoId: comment.todoId,
    threadCommentId: comment.threadCommentId,
    replyTo:
      comment.replyToCommentId == null
        ? null
        : {
            commentId: comment.replyToCommentId,
            authorName: isReplyTargetAuthorBlocked ? null : comment.replyToAuthorName,
          },
    author: isHidden
      ? null
      : {
          id: comment.authorId,
          name: comment.authorName,
          userTag: comment.authorUserTag,
          profileImage: resolveProfileImage(comment.authorProfileImage, appVersion),
          isTodoOwner: comment.authorId === comment.todoOwnerId,
        },
    content: isHidden ? null : comment.content,
    likeCount: isHidden ? 0 : comment.likeCount,
    replyCount: comment.replyCount,
    isDeleted: isHidden,
    isAuthorBlocked,
    isEdited: comment.editedAt != null,
    viewer: getTodoCommentViewerPermissions({
      isDeleted: isHidden,
      isLiked: viewer.likedCommentIds.has(comment.id),
      authorId: comment.authorId,
      viewerId: viewer.viewerId,
      todoOwnerId: comment.todoOwnerId,
    }),
    createdAt: toIsoString(comment.createdAt),
    editedAt: comment.editedAt == null ? null : toIsoString(comment.editedAt),
  };
}

/** 차단 관계인 작성자의 답글은 가린 묘비로 보이므로 대표 답글로 내보내지 않는다 */
export function toVisiblePreviewReply(
  item: TodoCommentThreadItemReadModel,
  viewer: TodoCommentViewer,
): TodoCommentReadModel | null {
  const preview = item.previewReply;
  return preview == null || viewer.blockedAuthorIds.has(preview.authorId) ? null : preview;
}

function toTodoCommentParticipantAuthor(
  author: TodoCommentParticipantAuthorReadModel,
  appVersion?: string,
): TodoCommentV2Author {
  return {
    id: author.id,
    name: author.name,
    userTag: author.userTag,
    profileImage: resolveProfileImage(author.profileImage, appVersion),
    isTodoOwner: author.isTodoOwner,
  };
}

export function toVisibleParticipantAuthors(
  item: TodoCommentThreadItemReadModel,
  viewer: TodoCommentViewer,
  appVersion?: string,
): TodoCommentV2Author[] {
  return item.participantAuthors
    .filter((author) => !viewer.blockedAuthorIds.has(author.id))
    .map((author) => toTodoCommentParticipantAuthor(author, appVersion));
}

export function toTodoCommentCursorPagination(
  page: TodoCommentCursorPage,
): TodoCommentCursorPagination {
  return {
    previousCursor: page.previousCursor,
    nextCursor: page.nextCursor,
    hasPrevious: page.hasPrevious,
    hasNext: page.hasNext,
    size: page.size,
  };
}

export function toTodoCommentThreadsResponse(
  page: TodoCommentThreadsPage,
  appVersion?: string,
): TodoCommentThreadsResponse {
  return {
    items: page.items.map((item) => {
      const previewReply = toVisiblePreviewReply(item, page.viewer);
      return {
        comment: toTodoCommentV2(item.comment, page.viewer, appVersion),
        previewReply:
          previewReply == null ? null : toTodoCommentV2(previewReply, page.viewer, appVersion),
        replySummary: {
          totalCount: item.totalCount,
          hiddenCount: Math.max(0, item.totalCount - (previewReply == null ? 0 : 1)),
          participantAuthors: toVisibleParticipantAuthors(item, page.viewer, appVersion),
        },
      };
    }),
    pagination: toTodoCommentCursorPagination(page.pagination),
    anchor: page.anchor,
  };
}

export function toTodoCommentRepliesResponse(
  page: TodoCommentRepliesPage,
  appVersion?: string,
): TodoCommentRepliesResponse {
  return {
    items: page.items.map((comment) => toTodoCommentV2(comment, page.viewer, appVersion)),
    pagination: toTodoCommentCursorPagination(page.pagination),
  };
}
