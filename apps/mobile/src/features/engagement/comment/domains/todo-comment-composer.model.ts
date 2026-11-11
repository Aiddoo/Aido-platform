import { TODO_COMMENT_LIMITS } from '@aido/api/vocabulary';
import { match } from 'ts-pattern';

import type { TodoCommentComposerMode } from '../schemas/todo-comment-form.schema';
import type { TodoCommentChainInput } from '../schemas/todo-comment-request.schema';
import type { TodoComment } from './todo-comment.model';

export function canChain(mode: TodoCommentComposerMode, itemCount: number) {
  return mode.type !== 'edit' && itemCount < TODO_COMMENT_LIMITS.CHAIN_MAX_SIZE;
}

// 답글은 대상 글에 그대로 단다. 서버가 그 글이 속한 묶음 끝에 붙인다
export function getReplyParentId(mode: TodoCommentComposerMode): string | null {
  return match(mode)
    .with({ type: 'reply' }, ({ target }) => target.id)
    .otherwise(() => null);
}

export interface PreparedTodoCommentSubmission {
  fingerprint: string;
  input: TodoCommentChainInput;
}

interface PrepareSubmissionInput {
  previousSubmission: PreparedTodoCommentSubmission | null;
  todoId: number;
  parentId: string | null;
  contents: readonly [string, ...string[]];
  createClientRequestId: () => string;
}

// 같은 글을 다시 보내면 처음 발급한 멱등 키를 다시 쓴다
export function prepareSubmission({
  previousSubmission,
  todoId,
  parentId,
  contents,
  createClientRequestId,
}: PrepareSubmissionInput): PreparedTodoCommentSubmission {
  const fingerprint = JSON.stringify([todoId, parentId, contents]);

  if (previousSubmission?.fingerprint === fingerprint) {
    return previousSubmission;
  }

  const [firstContent, ...remainingContents] = contents;
  const toItem = (content: string) => ({ clientRequestId: createClientRequestId(), content });

  return {
    fingerprint,
    input: { parentId, items: [toItem(firstContent), ...remainingContents.map(toItem)] },
  };
}

// 글자가 그대로면 서버에 보낼 것이 없다. 보낼 글은 앞뒤 공백을 지운 값이다
export function isSameAsOriginal(target: TodoComment, trimmedContent: string) {
  return target.content === trimmedContent;
}

export const TodoCommentComposerPolicy = {
  canChain,
  isSameAsOriginal,
  getReplyParentId,
  prepareSubmission,
} as const;
