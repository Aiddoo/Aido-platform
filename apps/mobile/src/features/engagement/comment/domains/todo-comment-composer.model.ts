import { TODO_COMMENT_LIMITS } from '@aido/api/vocabulary';
import { isApiError } from '@src/core/errors/api-error';
import { match } from 'ts-pattern';

import type {
  TodoCommentChainInput,
  TodoCommentComposerMode,
  TodoCommentFormValues,
} from '../schemas/todo-comment-form.schema';
import type { TodoComment } from '../schemas/todo-comment.schema';

/** 답글·수정을 쓰지 않은 채 키보드를 내리면(바깥 탭·뒤로가기) 작성기도 함께 닫는다. 쓴 글이 있으면 남긴다 */
function shouldCloseOnKeyboardHide({ mode, items }: TodoCommentFormValues) {
  return mode.type !== 'new' && items.every((item) => item.content.trim().length === 0);
}

function canChain(mode: TodoCommentComposerMode, itemCount: number) {
  return mode.type !== 'edit' && itemCount < TODO_COMMENT_LIMITS.CHAIN_MAX_SIZE;
}

function getComposerTarget(mode: TodoCommentComposerMode): TodoComment | null {
  return match(mode)
    .with({ type: 'new' }, () => null)
    .with({ type: 'reply' }, { type: 'edit' }, ({ target }) => target)
    .exhaustive();
}

/** 답글은 대상 글에 그대로 단다. 서버가 그 글이 속한 묶음 끝에 붙인다 */
function getReplyParentId(mode: TodoCommentComposerMode): string | null {
  return match(mode)
    .with({ type: 'reply' }, ({ target }) => target.id)
    .otherwise(() => null);
}

export interface PreparedTodoCommentSubmission {
  fingerprint: string;
  input: TodoCommentChainInput;
}

interface PrepareSubmissionParams {
  previousSubmission: PreparedTodoCommentSubmission | null;
  todoId: number;
  parentId: string | null;
  contents: readonly [string, ...string[]];
  createClientRequestId: () => string;
}

/** 같은 글을 다시 보내면 처음 발급한 멱등 키를 다시 쓴다 */
function prepareSubmission({
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

function getTrimmedContents(items: TodoCommentFormValues['items']): [string, ...string[]] | null {
  const [first, ...rest] = items.map((item) => item.content.trim());
  return first == null ? null : [first, ...rest];
}

/** 글자가 그대로면 서버에 보낼 것이 없다. 보낼 글은 앞뒤 공백을 지운 값이다 */
function isSameAsOriginal(target: Pick<TodoComment, 'content'>, trimmedContent: string) {
  return target.content === trimmedContent;
}

type TodoCommentBackAction = 'blocked' | 'closeComposer' | 'native';

/** 작성기가 열려 있으면 먼저 닫고, 아니면 화면을 닫는다. 보내는 중에는 초안을 지키려고 막는다 */
function getBackAction(
  mode: TodoCommentComposerMode,
  isSubmitting: boolean,
): TodoCommentBackAction {
  return match({ type: mode.type, isSubmitting })
    .returnType<TodoCommentBackAction>()
    .with({ isSubmitting: true }, () => 'blocked')
    .with({ type: 'new' }, () => 'native')
    .otherwise(() => 'closeComposer');
}

/** 4xx는 같은 글을 다시 보내도 같은 결과라 새 멱등 키로 다시 보낼 수 있게 한다. 나머지는 같은 키로 재시도한다 */
function needsNewSubmissionAfterFailure(error: unknown) {
  return isApiError(error) && error.status >= 400 && error.status < 500;
}

export const TodoCommentComposerPolicy = {
  getBackAction,
  canChain,
  isSameAsOriginal,
  shouldCloseOnKeyboardHide,
  getComposerTarget,
  getReplyParentId,
  prepareSubmission,
  needsNewSubmissionAfterFailure,
  getTrimmedContents,
} as const;
