import type { CreateTodoCommentChainInput } from '@aido/validators';

export interface PreparedTodoCommentSubmission {
  fingerprint: string;
  input: CreateTodoCommentChainInput;
}

interface PrepareTodoCommentSubmissionParams {
  previousSubmission: PreparedTodoCommentSubmission | null;
  todoId: number;
  parentId: string | null;
  contents: readonly [string, ...string[]];
  createClientRequestId: () => string;
}

function createTodoCommentChainInput(
  parentId: string | null,
  contents: readonly [string, ...string[]],
  createClientRequestId: () => string,
): CreateTodoCommentChainInput {
  const [firstContent, ...remainingContents] = contents;
  const toItem = (content: string): CreateTodoCommentChainInput['items'][number] => ({
    clientRequestId: createClientRequestId(),
    content,
  });

  return {
    parentId,
    items: [toItem(firstContent), ...remainingContents.map(toItem)],
  };
}

/** 같은 logical submission의 재시도에는 최초에 발급한 idempotency key를 재사용한다. */
export function prepareTodoCommentSubmission({
  previousSubmission,
  todoId,
  parentId,
  contents,
  createClientRequestId,
}: PrepareTodoCommentSubmissionParams): PreparedTodoCommentSubmission {
  const fingerprint = JSON.stringify([todoId, parentId, contents]);

  if (previousSubmission?.fingerprint === fingerprint) {
    return previousSubmission;
  }

  return {
    fingerprint,
    input: createTodoCommentChainInput(parentId, contents, createClientRequestId),
  };
}
