import { TODO_COMMENT_LIMITS } from '@aido/api/vocabulary';
import { instantSchema } from '@src/shared/date/instant';
import { selectPageItems } from '@src/shared/domains/cursor-page.model';
import { userSummarySchema } from '@src/shared/domains/user-summary.model';
import { uniqBy } from 'es-toolkit';
import { match } from 'ts-pattern';
import { z } from 'zod';

const todoCommentAuthorSchema = userSummarySchema.extend({
  userTag: z.string().nullable(),
  isTodoOwner: z.boolean(),
});
export type TodoCommentAuthor = z.infer<typeof todoCommentAuthorSchema>;

export const todoCommentSchema = z.object({
  id: z.string(),
  todoId: z.int().positive(),
  threadCommentId: z.string().nullable(),
  replyTo: z
    .object({
      commentId: z.string(),
      authorName: z.string().nullable(),
    })
    .nullable(),
  author: todoCommentAuthorSchema.nullable(),
  content: z.string().nullable(),
  likeCount: z.int().nonnegative(),
  replyCount: z.int().nonnegative(),
  isDeleted: z.boolean(),
  isAuthorBlocked: z.boolean(),
  isEdited: z.boolean(),
  viewer: z.object({
    isLiked: z.boolean(),
    canEdit: z.boolean(),
    canDelete: z.boolean(),
    canReply: z.boolean(),
    canReport: z.boolean(),
    canBlock: z.boolean(),
  }),
  createdAt: instantSchema,
  editedAt: instantSchema.nullable(),
});
export type TodoComment = z.infer<typeof todoCommentSchema>;

export const todoCommentThreadSchema = z.object({
  comment: todoCommentSchema,
  previewReply: todoCommentSchema.nullable(),
  replySummary: z.object({
    totalCount: z.int().nonnegative(),
    hiddenCount: z.int().nonnegative(),
    participantAuthors: z
      .array(todoCommentAuthorSchema)
      .max(TODO_COMMENT_LIMITS.OVERVIEW_PARTICIPANT_MAX_SIZE),
  }),
});
export type TodoCommentThread = z.infer<typeof todoCommentThreadSchema>;

const todoCommentThreadAnchorSchema = z.object({
  threadCommentId: z.string(),
  replyId: z.string().nullable(),
});
export type TodoCommentThreadAnchor = z.infer<typeof todoCommentThreadAnchorSchema>;

const todoCommentPaginationSchema = z.object({
  previousCursor: z.string().nullable(),
  nextCursor: z.string().nullable(),
  hasPrevious: z.boolean(),
  hasNext: z.boolean(),
  size: z.int().positive(),
});
export type TodoCommentPagination = z.infer<typeof todoCommentPaginationSchema>;

export const todoCommentThreadPageSchema = z.object({
  items: z.array(todoCommentThreadSchema),
  pagination: todoCommentPaginationSchema,
  anchor: todoCommentThreadAnchorSchema.nullable(),
});
export type TodoCommentThreadPage = z.infer<typeof todoCommentThreadPageSchema>;

const todoCommentReplyPageSchema = z.object({
  items: z.array(todoCommentSchema),
  pagination: todoCommentPaginationSchema,
});
export type TodoCommentReplyPage = z.infer<typeof todoCommentReplyPageSchema>;

const todoCommentChainSchema = z.object({ comments: z.array(todoCommentSchema) });
export type TodoCommentChain = z.infer<typeof todoCommentChainSchema>;

const todoCommentLikeResultSchema = z.object({
  commentId: z.string(),
  isLiked: z.boolean(),
  likeCount: z.int().nonnegative(),
});
export type TodoCommentLikeResult = z.infer<typeof todoCommentLikeResultSchema>;

type TodoCommentDisplayState = 'active' | 'deleted' | 'blockedAuthor';

function isActiveComment(comment: TodoComment) {
  return TodoCommentPolicy.getDisplayState(comment) === 'active';
}

function withReplyCount(thread: TodoCommentThread, totalCount: number): TodoCommentThread {
  const visibleCount = Math.max(0, totalCount);
  const previewCount = thread.previewReply == null ? 0 : 1;

  return {
    ...thread,
    comment: { ...thread.comment, replyCount: visibleCount },
    replySummary: {
      ...thread.replySummary,
      totalCount: visibleCount,
      hiddenCount: Math.max(0, visibleCount - previewCount),
    },
  };
}

function toTombstone(comment: TodoComment): TodoComment {
  return {
    ...comment,
    author: null,
    content: null,
    isDeleted: true,
    likeCount: 0,
    viewer: {
      ...comment.viewer,
      isLiked: false,
      canEdit: false,
      canDelete: false,
      canReply: false,
      canReport: false,
      canBlock: false,
    },
  };
}

export const TodoCommentPolicy = {
  getDisplayState(comment: TodoComment): TodoCommentDisplayState {
    return match(comment)
      .returnType<TodoCommentDisplayState>()
      .with({ isAuthorBlocked: true }, () => 'blockedAuthor')
      .with({ isDeleted: true }, () => 'deleted')
      .otherwise(() => 'active');
  },

  isReply(comment: TodoComment): boolean {
    return comment.threadCommentId != null;
  },

  canLikeComment(comment: TodoComment): boolean {
    return isActiveComment(comment);
  },

  canReplyToComment(comment: TodoComment): boolean {
    return isActiveComment(comment) && comment.viewer.canReply;
  },

  canEditComment(comment: TodoComment): boolean {
    return isActiveComment(comment) && comment.viewer.canEdit;
  },

  canDeleteComment(comment: TodoComment): boolean {
    return isActiveComment(comment) && comment.viewer.canDelete;
  },

  // 내 할 일에 달린 남의 글. 수정은 작성자만 할 수 있어 지울 수만 있으면 남의 글이다
  canDeleteOnlyAsTodoOwner(comment: TodoComment): boolean {
    return this.canDeleteComment(comment) && !comment.viewer.canEdit;
  },

  canCopyComment(comment: TodoComment): boolean {
    return isActiveComment(comment) && comment.content != null;
  },

  canReportComment(comment: TodoComment): boolean {
    return isActiveComment(comment) && comment.viewer.canReport;
  },

  canBlockCommentAuthor(comment: TodoComment): boolean {
    return isActiveComment(comment) && comment.author != null && comment.viewer.canBlock;
  },

  hasCommentActions(comment: TodoComment): boolean {
    return (
      this.canEditComment(comment) ||
      this.canCopyComment(comment) ||
      this.canDeleteComment(comment) ||
      this.canReportComment(comment) ||
      this.canBlockCommentAuthor(comment)
    );
  },

  // 답글이 남은 댓글은 지워도 "삭제된 댓글이에요"로 남는다
  isTombstonedOnDelete(comment: TodoComment): boolean {
    return !this.isReply(comment) && comment.replyCount > 0;
  },

  getHiddenReplyCount(thread: TodoCommentThread, loadedCount: number): number {
    return Math.max(0, thread.replySummary.totalCount - loadedCount);
  },

  // 접힌 묶음은 대표 답글 하나를 보이므로, 대표 답글이 없으면 답글 전체가 숨은 수다
  getCollapsedHiddenReplyCount(thread: TodoCommentThread): number {
    return thread.previewReply == null
      ? thread.replySummary.totalCount
      : thread.replySummary.hiddenCount;
  },

  hasRepliesToShow(thread: TodoCommentThread): boolean {
    return thread.replySummary.totalCount > 0;
  },

  flattenThreads(pages: readonly TodoCommentThreadPage[]): TodoCommentThread[] {
    return uniqBy(selectPageItems({ pages }), (thread) => thread.comment.id);
  },

  // 방금 쓴 답글은 마지막 페이지 끝에 먼저 붙고, 남은 페이지를 받으면 그 뒤 위치(작성 순)로 옮겨 간다
  flattenReplies(pages: readonly TodoCommentReplyPage[]): TodoComment[] {
    return uniqBy(selectPageItems({ pages }).toReversed(), (reply) => reply.id).toReversed();
  },

  withLiked(comment: TodoComment, isLiked: boolean): TodoComment {
    if (comment.viewer.isLiked === isLiked) {
      return comment;
    }

    return {
      ...comment,
      likeCount: Math.max(0, comment.likeCount + (isLiked ? 1 : -1)),
      viewer: { ...comment.viewer, isLiked },
    };
  },

  withLikeResult(comment: TodoComment, result: TodoCommentLikeResult): TodoComment {
    return {
      ...comment,
      likeCount: result.likeCount,
      viewer: { ...comment.viewer, isLiked: result.isLiked },
    };
  },

  withContentEdited(comment: TodoComment, content: string): TodoComment {
    return { ...comment, content, isEdited: true };
  },

  // 새 답글은 묶음 수만 늘리고, 대표 답글이 없던 묶음은 그 답글을 대표로 보인다
  withReplyAdded(thread: TodoCommentThread, replies: readonly TodoComment[]): TodoCommentThread {
    const [firstReply] = replies;
    const withPreview =
      thread.previewReply == null && firstReply != null
        ? { ...thread, previewReply: firstReply }
        : thread;

    return withReplyCount(withPreview, thread.replySummary.totalCount + replies.length);
  },

  // 답글이 남은 댓글은 tombstone이 되고, 답글 없는 tombstone 댓글은 묶음째 사라져 null이다
  withCommentRemoved(thread: TodoCommentThread, removed: TodoComment): TodoCommentThread | null {
    if (thread.comment.id === removed.id) {
      return this.hasRepliesToShow(thread)
        ? { ...thread, comment: toTombstone(thread.comment) }
        : null;
    }

    if (removed.threadCommentId !== thread.comment.id) {
      return thread;
    }

    const withoutPreview =
      thread.previewReply?.id === removed.id ? { ...thread, previewReply: null } : thread;
    const next = withReplyCount(withoutPreview, thread.replySummary.totalCount - 1);

    return next.comment.isDeleted && next.replySummary.totalCount === 0 ? null : next;
  },

  withRepliesRemoved(replies: readonly TodoComment[], commentId: string): TodoComment[] {
    return replies.filter((reply) => reply.id !== commentId);
  },

  findCommentInThread(thread: TodoCommentThread, commentId: string): TodoComment | null {
    return (
      [thread.comment, thread.previewReply].find((comment) => comment?.id === commentId) ?? null
    );
  },
};
