import { TODO_COMMENT_KIND, type TodoCommentKind } from "@aido/api/vocabulary";

import { ValueObject } from "#api/shared/domain/model/value-object";

type CommentPlacementValue =
  | { readonly kind: typeof TODO_COMMENT_KIND.COMMENT }
  | {
      readonly kind: typeof TODO_COMMENT_KIND.REPLY;
      readonly threadCommentId: string;
      readonly replyToCommentId: string;
    };

interface ReplyTarget {
  readonly id: string;
  readonly placement: CommentPlacement;
}

/** 할 일에 바로 단 댓글인지, 어느 묶음에서 어느 글에 단 답글인지. 묶음은 2단계를 넘지 않는다 */
export class CommentPlacement extends ValueObject<CommentPlacementValue> {
  /** 대상이 없으면 댓글이다. 답글에 답해도 같은 묶음에 붙고, 대상이 답글이면 그 답글의 묶음 머리를 따라간다 */
  static create(replyTarget: ReplyTarget | null): CommentPlacement {
    if (replyTarget == null) {
      return new CommentPlacement({ kind: TODO_COMMENT_KIND.COMMENT });
    }
    const threadCommentId = replyTarget.placement.threadCommentId ?? replyTarget.id;
    return new CommentPlacement({
      kind: TODO_COMMENT_KIND.REPLY,
      threadCommentId,
      replyToCommentId: replyTarget.id,
    });
  }

  /** 저장된 묶음 머리와 답글 대상으로 복원한다. 대상이 지워져 비었으면 묶음 머리에 단 답글로 본다 */
  static reconstitute(stored: {
    readonly parentId: string | null;
    readonly replyToCommentId: string | null;
  }): CommentPlacement {
    if (stored.parentId == null) {
      return new CommentPlacement({ kind: TODO_COMMENT_KIND.COMMENT });
    }
    return new CommentPlacement({
      kind: TODO_COMMENT_KIND.REPLY,
      threadCommentId: stored.parentId,
      replyToCommentId: stored.replyToCommentId ?? stored.parentId,
    });
  }

  get kind(): TodoCommentKind {
    return this.value.kind;
  }

  get isReply(): boolean {
    return this.value.kind === TODO_COMMENT_KIND.REPLY;
  }

  /** 답글이 속한 묶음의 머리 댓글. 댓글이면 null */
  get threadCommentId(): string | null {
    return this.value.kind === TODO_COMMENT_KIND.REPLY ? this.value.threadCommentId : null;
  }

  /** 답글이 답한 글. 댓글이면 null */
  get replyToCommentId(): string | null {
    return this.value.kind === TODO_COMMENT_KIND.REPLY ? this.value.replyToCommentId : null;
  }
}
