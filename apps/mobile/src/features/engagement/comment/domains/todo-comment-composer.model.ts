import { TODO_COMMENT_LIMITS } from '@aido/api/vocabulary';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { type TodoComment, todoCommentSchema } from './todo-comment.model';

/** 작성기가 지금 하는 일(새 댓글·답글·수정)과 그 대상 글. 입력한 글은 폼 값이다 */
export const todoCommentComposerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('new') }),
  z.object({ type: z.literal('reply'), target: todoCommentSchema }),
  z.object({ type: z.literal('edit'), target: todoCommentSchema }),
]);
export type TodoCommentComposer = z.infer<typeof todoCommentComposerSchema>;

export type TodoCommentBackAction = 'blocked' | 'closeComposer' | 'native';

export function getTrimmedContent(content: string): string {
  return content.trim();
}

/** 입력 칸에 보낼 글이 없다. 공백만 있어도 비었다고 본다 */
export function isBlankContent(content: string): boolean {
  return getTrimmedContent(content).length === 0;
}

export const TodoCommentComposerPolicy = {
  /** 작성기가 향한 글(답글 대상 또는 수정할 글). 새 글이면 null */
  findTarget(composer: TodoCommentComposer): TodoComment | null {
    return match(composer)
      .with({ type: 'new' }, () => null)
      .with({ type: 'reply' }, { type: 'edit' }, ({ target }) => target)
      .exhaustive();
  },

  // 답글은 대상 글에 그대로 단다. 서버가 그 글이 속한 묶음 끝에 붙인다
  findReplyParentId(composer: TodoCommentComposer): string | null {
    return match(composer)
      .with({ type: 'reply' }, ({ target }) => target.id)
      .otherwise(() => null);
  },

  canChain(composer: TodoCommentComposer, itemCount: number) {
    return composer.type !== 'edit' && itemCount < TODO_COMMENT_LIMITS.CHAIN_MAX_SIZE;
  },

  // 글자가 그대로면 서버에 보낼 것이 없다. 보낼 글은 앞뒤 공백을 지운 값이다
  isUnchanged(composer: TodoCommentComposer, trimmedContent: string) {
    return composer.type === 'edit' && composer.target.content === trimmedContent;
  },

  /** 작성기가 열려 있으면 먼저 닫고, 아니면 화면을 닫는다. 보내는 중에는 초안을 지키려고 막는다 */
  getBackAction(
    composer: TodoCommentComposer,
    { isSubmitting }: { isSubmitting: boolean },
  ): TodoCommentBackAction {
    return match({ type: composer.type, isSubmitting })
      .returnType<TodoCommentBackAction>()
      .with({ isSubmitting: true }, () => 'blocked')
      .with({ type: 'new' }, () => 'native')
      .otherwise(() => 'closeComposer');
  },
};
