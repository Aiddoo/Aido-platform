import type {
  TodoCommentCursorPagination,
  TodoCommentRepliesResponse,
  TodoCommentThreadsResponse,
  TodoCommentV2,
  TodoCommentV2Author,
} from "@aido/api";

import { resolveProfileImage } from "#api/platform/http/profile/profile-image.resolver";

import type {
  TodoCommentParticipantAuthorReadModel,
  TodoCommentReadModel,
  TodoCommentRepliesPage,
  TodoCommentThreadItemReadModel,
  TodoCommentThreadsPage,
  TodoCommentViewer,
} from "../../../application/read-models/todo-comment.read-model.js";
import { getTodoCommentViewerPermissions } from "../../../domain/todo-comment-permission.domain-service.js";

/**
 * v1·v2가 함께 쓰는 댓글 표현. viewer와 차단 관계인 작성자의 글은 위치만 남기고 삭제된 글처럼 가린다.
 * isAuthorBlocked를 모르는 구 앱도 삭제된 댓글로 그려 차단한 사람의 이름·내용이 보이지 않는다.
 */
export function toTodoCommentView(
  record: TodoCommentReadModel,
  viewer: TodoCommentViewer,
): TodoCommentV2 {
  const isAuthorBlocked = viewer.blockedAuthorIds.has(record.authorId);
  const isHidden = record.deletedAt != null || isAuthorBlocked;
  const isReplyTargetAuthorBlocked =
    record.replyToAuthorId != null && viewer.blockedAuthorIds.has(record.replyToAuthorId);

  return {
    id: record.id,
    todoId: record.todoId,
    threadCommentId: record.threadCommentId,
    replyTo:
      record.replyToCommentId == null
        ? null
        : {
            commentId: record.replyToCommentId,
            authorName: isReplyTargetAuthorBlocked ? null : record.replyToAuthorName,
          },
    author: isHidden
      ? null
      : {
          id: record.authorId,
          name: record.authorName,
          userTag: record.authorUserTag,
          profileImage: record.authorProfileImage,
          isTodoOwner: record.authorId === record.todoOwnerId,
        },
    content: isHidden ? null : record.content,
    likeCount: isHidden ? 0 : record.likeCount,
    replyCount: record.replyCount,
    isDeleted: isHidden,
    isAuthorBlocked,
    isEdited: record.editedAt != null,
    viewer: getTodoCommentViewerPermissions({
      isDeleted: isHidden,
      isLiked: viewer.likedCommentIds.has(record.id),
      authorId: record.authorId,
      viewerId: viewer.viewerId,
      todoOwnerId: record.todoOwnerId,
    }),
    createdAt: record.createdAt,
    editedAt: record.editedAt,
  };
}

/** 차단 관계인 작성자의 답글은 가린 묘비로 보이므로 대표 답글로 내보내지 않는다. */
export function toVisiblePreviewReply(
  item: TodoCommentThreadItemReadModel,
  viewer: TodoCommentViewer,
): TodoCommentReadModel | null {
  const preview = item.previewReply;
  return preview == null || viewer.blockedAuthorIds.has(preview.authorId) ? null : preview;
}

export function toTodoCommentParticipantAuthor(
  record: TodoCommentParticipantAuthorReadModel,
): TodoCommentV2Author {
  return {
    id: record.id,
    name: record.name,
    userTag: record.userTag,
    profileImage: record.profileImage,
    isTodoOwner: record.isTodoOwner,
  };
}

/** 응답에 실릴 수 있는 작성자 ID. 차단 관계를 한 번에 조회하는 후보로 쓴다. */
export function collectCommentAuthorIds(records: readonly TodoCommentReadModel[]): string[] {
  return records.flatMap((record) =>
    record.replyToAuthorId == null ? [record.authorId] : [record.authorId, record.replyToAuthorId],
  );
}

export function collectCommentIds(records: readonly TodoCommentReadModel[]): string[] {
  return records.map((record) => record.id);
}

export function toTodoCommentCursorPagination(input: {
  size: number;
  hasPrevious: boolean;
  hasNext: boolean;
  previousCursor: string | null;
  nextCursor: string | null;
}): TodoCommentCursorPagination {
  return {
    previousCursor: input.previousCursor,
    nextCursor: input.nextCursor,
    hasPrevious: input.hasPrevious,
    hasNext: input.hasNext,
    size: input.size,
  };
}

export function toTodoCommentThreadsResponse(
  result: TodoCommentThreadsPage,
): TodoCommentThreadsResponse {
  return {
    items: result.items.map((item) => {
      const previewReply = toVisiblePreviewReply(item, result.viewer);

      return {
        comment: toTodoCommentView(item.comment, result.viewer),
        previewReply: previewReply == null ? null : toTodoCommentView(previewReply, result.viewer),
        replySummary: {
          totalCount: item.totalCount,
          hiddenCount: Math.max(0, item.totalCount - (previewReply == null ? 0 : 1)),
          participantAuthors: item.participantAuthors
            .filter((author) => !result.viewer.blockedAuthorIds.has(author.id))
            .map(toTodoCommentParticipantAuthor),
        },
      };
    }),
    pagination: result.pagination,
    anchor: result.anchor,
  };
}

export function toTodoCommentRepliesResponse(
  result: TodoCommentRepliesPage,
): TodoCommentRepliesResponse {
  return {
    items: result.items.map((record) => toTodoCommentView(record, result.viewer)),
    pagination: result.pagination,
  };
}

const toAuthor = (author: TodoCommentV2Author, appVersion?: string): TodoCommentV2Author => ({
  ...author,
  profileImage: resolveProfileImage(author.profileImage, appVersion),
});

const toComment = (comment: TodoCommentV2, appVersion?: string): TodoCommentV2 => ({
  ...comment,
  author: comment.author && toAuthor(comment.author, appVersion),
});

export const TodoCommentV2Mapper = {
  toThreads: (
    result: TodoCommentThreadsResponse,
    appVersion?: string,
  ): TodoCommentThreadsResponse => ({
    ...result,
    items: result.items.map((item) => ({
      ...item,
      comment: toComment(item.comment, appVersion),
      previewReply: item.previewReply && toComment(item.previewReply, appVersion),
      replySummary: {
        ...item.replySummary,
        participantAuthors: item.replySummary.participantAuthors.map((author) =>
          toAuthor(author, appVersion),
        ),
      },
    })),
  }),
  toReplies: (
    result: TodoCommentRepliesResponse,
    appVersion?: string,
  ): TodoCommentRepliesResponse => ({
    ...result,
    items: result.items.map((comment) => toComment(comment, appVersion)),
  }),
};
