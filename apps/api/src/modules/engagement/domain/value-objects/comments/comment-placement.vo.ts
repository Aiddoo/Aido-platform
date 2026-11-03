import { TODO_COMMENT_KIND } from "@aido/api/vocabulary";

export type CommentPlacement =
  | { readonly kind: typeof TODO_COMMENT_KIND.COMMENT }
  | {
      readonly kind: typeof TODO_COMMENT_KIND.REPLY;
      readonly threadCommentId: string;
      readonly replyToCommentId: string;
    };

export const CommentPlacement = {
  comment(): CommentPlacement {
    return { kind: TODO_COMMENT_KIND.COMMENT };
  },
  /** 답글에 답해도 같은 묶음에 붙는다. 대상이 답글이면 그 답글의 묶음 머리를 따라간다. */
  replyTo(target: { readonly id: string; readonly placement: CommentPlacement }): CommentPlacement {
    const threadCommentId =
      target.placement.kind === TODO_COMMENT_KIND.COMMENT
        ? target.id
        : target.placement.threadCommentId;

    return { kind: TODO_COMMENT_KIND.REPLY, threadCommentId, replyToCommentId: target.id };
  },
  /** 저장된 묶음 머리와 답글 대상으로 복원한다. 대상이 지워져 비었으면 묶음 머리에 단 답글로 본다. */
  reconstitute(stored: {
    readonly parentId: string | null;
    readonly replyToCommentId: string | null;
  }): CommentPlacement {
    if (stored.parentId == null) {
      return CommentPlacement.comment();
    }

    return {
      kind: TODO_COMMENT_KIND.REPLY,
      threadCommentId: stored.parentId,
      replyToCommentId: stored.replyToCommentId ?? stored.parentId,
    };
  },
} as const;
