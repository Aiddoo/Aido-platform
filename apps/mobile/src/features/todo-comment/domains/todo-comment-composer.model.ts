import {
  TODO_COMMENT_LIMITS,
  type CreateTodoCommentChainInput,
  todoCommentContentSchema,
} from '@aido/api';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { type TodoComment, todoCommentSchema } from './todo-comment.model';

export const todoCommentComposerModeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('new') }),
  z.object({ type: z.literal('reply'), target: todoCommentSchema }),
  z.object({ type: z.literal('edit'), target: todoCommentSchema }),
]);
export type TodoCommentComposerMode = z.infer<typeof todoCommentComposerModeSchema>;

export const todoCommentComposerFormSchema = z.object({
  mode: todoCommentComposerModeSchema,
  items: z
    .array(z.object({ content: todoCommentContentSchema }))
    .min(1)
    .max(TODO_COMMENT_LIMITS.CHAIN_MAX_SIZE),
});
export type TodoCommentComposerForm = z.infer<typeof todoCommentComposerFormSchema>;

const EMPTY_ITEMS: TodoCommentComposerForm['items'] = [{ content: '' }];

export function newComposer(): TodoCommentComposerForm {
  return { mode: { type: 'new' }, items: EMPTY_ITEMS };
}

export function replyComposer(target: TodoComment): TodoCommentComposerForm {
  return { mode: { type: 'reply', target }, items: EMPTY_ITEMS };
}

export function editComposer(target: TodoComment): TodoCommentComposerForm {
  return { mode: { type: 'edit', target }, items: [{ content: target.content ?? '' }] };
}

export function canChainComposer(mode: TodoCommentComposerMode, itemCount: number) {
  return mode.type !== 'edit' && itemCount < TODO_COMMENT_LIMITS.CHAIN_MAX_SIZE;
}

export function targetOf(mode: TodoCommentComposerMode): TodoComment | null {
  return match(mode)
    .with({ type: 'new' }, () => null)
    .with({ type: 'reply' }, { type: 'edit' }, ({ target }) => target)
    .exhaustive();
}

/** 답글은 대상 글에 그대로 단다. 서버가 그 글이 속한 묶음 끝에 붙인다 */
export function replyParentIdOf(mode: TodoCommentComposerMode): string | null {
  return match(mode)
    .with({ type: 'reply' }, ({ target }) => target.id)
    .otherwise(() => null);
}

/** 초안은 새 댓글·답글은 할 일마다, 수정은 수정하는 글마다 나눈다 */
export function draftTargetOf(todoId: number, mode: TodoCommentComposerMode) {
  return match(mode)
    .with({ type: 'edit' }, ({ target }) => [todoId, 'edit', target.id] as const)
    .with({ type: 'reply' }, () => [todoId, 'reply'] as const)
    .with({ type: 'new' }, () => [todoId, 'new'] as const)
    .exhaustive();
}

export function draftSourceUpdatedAtOf(mode: TodoCommentComposerMode) {
  return match(mode)
    .with({ type: 'edit' }, ({ target }) => (target.editedAt ?? target.createdAt).getTime())
    .otherwise(() => undefined);
}

export interface PreparedTodoCommentSubmission {
  fingerprint: string;
  input: CreateTodoCommentChainInput;
}

interface PrepareSubmissionParams {
  previousSubmission: PreparedTodoCommentSubmission | null;
  todoId: number;
  parentId: string | null;
  contents: readonly [string, ...string[]];
  createClientRequestId: () => string;
}

/** 같은 글을 다시 보내면 처음 발급한 멱등 키를 다시 쓴다 */
export function prepareSubmission({
  previousSubmission,
  todoId,
  parentId,
  contents,
  createClientRequestId,
}: PrepareSubmissionParams): PreparedTodoCommentSubmission {
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

export function trimmedContentsOf(
  items: TodoCommentComposerForm['items'],
): [string, ...string[]] | null {
  const [first, ...rest] = items.map((item) => item.content.trim());
  return first == null ? null : [first, ...rest];
}

export const TodoCommentComposer = {
  new: newComposer,
  reply: replyComposer,
  edit: editComposer,
  canChain: canChainComposer,
  targetOf,
  replyParentIdOf,
  draftTargetOf,
  draftSourceUpdatedAtOf,
  prepareSubmission,
  trimmedContentsOf,
} as const;
