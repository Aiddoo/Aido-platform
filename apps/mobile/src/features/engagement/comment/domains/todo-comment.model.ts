import { instantSchema } from '@src/shared/date/instant';
import { userSummarySchema } from '@src/shared/domains/user-summary.model';
import { match } from 'ts-pattern';
import { z } from 'zod';

export const todoCommentAuthorSchema = userSummarySchema.extend({
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

const todoCommentChainSchema = z.object({ comments: z.array(todoCommentSchema) });
export type TodoCommentChain = z.infer<typeof todoCommentChainSchema>;

const todoCommentLikeResultSchema = z.object({
  commentId: z.string(),
  isLiked: z.boolean(),
  likeCount: z.int().nonnegative(),
});
export type TodoCommentLikeResult = z.infer<typeof todoCommentLikeResultSchema>;

type TodoCommentDisplayState = 'active' | 'deleted' | 'blockedAuthor';

export const TodoCommentPolicy = {
  getDisplayState(comment: TodoComment): TodoCommentDisplayState {
    return match(comment)
      .returnType<TodoCommentDisplayState>()
      .with({ isAuthorBlocked: true }, () => 'blockedAuthor')
      .with({ isDeleted: true }, () => 'deleted')
      .otherwise(() => 'active');
  },

  isActive(comment: TodoComment): boolean {
    return this.getDisplayState(comment) === 'active';
  },

  isReply(comment: TodoComment) {
    return comment.threadCommentId != null;
  },

  canLikeComment(comment: TodoComment): boolean {
    return this.isActive(comment);
  },

  canReplyToComment(comment: TodoComment): boolean {
    return this.isActive(comment) && comment.viewer.canReply;
  },

  canEditComment(comment: TodoComment): boolean {
    return this.isActive(comment) && comment.viewer.canEdit;
  },

  canDeleteComment(comment: TodoComment): boolean {
    return this.isActive(comment) && comment.viewer.canDelete;
  },

  // 내 할 일에 달린 남의 글. 수정은 작성자만 할 수 있어 지울 수만 있으면 남의 글이다
  canDeleteOnlyAsTodoOwner(comment: TodoComment): boolean {
    return this.canDeleteComment(comment) && !comment.viewer.canEdit;
  },

  /** 복사할 글. 지워졌거나 차단한 사람의 글은 없다 */
  findCopyableContent(comment: TodoComment): string | null {
    return this.isActive(comment) ? comment.content : null;
  },

  canCopyComment(comment: TodoComment): boolean {
    return this.findCopyableContent(comment) != null;
  },

  canReportComment(comment: TodoComment): boolean {
    return this.isActive(comment) && comment.viewer.canReport;
  },

  canBlockCommentAuthor(comment: TodoComment): boolean {
    return this.isActive(comment) && comment.author != null && comment.viewer.canBlock;
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

  /** 답글이 남아 자리만 지키는 지운 댓글 */
  withTombstoned(comment: TodoComment): TodoComment {
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
  },
};
