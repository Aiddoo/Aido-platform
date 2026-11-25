import { TODO_COMMENT_LIMITS } from '@aido/api/vocabulary';
import { z } from 'zod';

import {
  type TodoComment,
  todoCommentAuthorSchema,
  TodoCommentPolicy,
  todoCommentSchema,
} from './todo-comment.model';

/** 한 묶음: 댓글 하나와 그 답글. 답글의 답글도 같은 묶음에 붙어 깊이는 두 단이다 */
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

export const TodoCommentThreadPolicy = {
  getHiddenReplyCount(thread: TodoCommentThread, loadedCount: number) {
    return Math.max(0, thread.replySummary.totalCount - loadedCount);
  },

  // 접힌 묶음은 대표 답글 하나를 보이므로, 대표 답글이 없으면 답글 전체가 숨은 수다
  getCollapsedHiddenReplyCount(thread: TodoCommentThread) {
    return thread.previewReply == null
      ? thread.replySummary.totalCount
      : thread.replySummary.hiddenCount;
  },

  hasRepliesToShow(thread: TodoCommentThread) {
    return thread.replySummary.totalCount > 0;
  },

  /** 알림·링크로 연 위치가 이 묶음의 답글이면 그 답글. 댓글 자신이거나 다른 묶음이면 null */
  findAnchoredReplyId(thread: TodoCommentThread, anchor: TodoCommentThreadAnchor | null) {
    return anchor?.threadCommentId === thread.comment.id ? anchor.replyId : null;
  },

  findCommentInThread(thread: TodoCommentThread, commentId: string): TodoComment | null {
    return (
      [thread.comment, thread.previewReply].find((comment) => comment?.id === commentId) ?? null
    );
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
        ? { ...thread, comment: TodoCommentPolicy.withTombstoned(thread.comment) }
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
};
