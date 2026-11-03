export interface TodoCommentState {
  readonly id: string;
  readonly todoId: number;
  readonly authorId: string;
  /** 답글이 속한 묶음의 머리 댓글. 댓글이면 null */
  readonly parentId: string | null;
  /** 답글이 답한 글(댓글 또는 같은 묶음의 답글). 댓글이면 null */
  readonly replyToCommentId: string | null;
  readonly content: string | null;
  readonly replyCount: number;
  readonly deletedAt: Date | null;
  readonly editedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
