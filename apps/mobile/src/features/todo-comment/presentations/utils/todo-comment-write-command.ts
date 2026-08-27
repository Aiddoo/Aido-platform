import type { CreateTodoCommentChainInput } from '@aido/validators';
import * as Crypto from 'expo-crypto';

import type { TodoComment } from '../../models/todo-comment.model';

export interface WriteTodoCommentsCommand {
  fingerprint: string;
  variables: CreateTodoCommentChainInput;
}

export function getWriteTodoCommentsCommand(
  current: WriteTodoCommentsCommand | null,
  todoId: number,
  parent: TodoComment | null,
  contents: readonly [string, ...string[]],
): WriteTodoCommentsCommand {
  const fingerprint = JSON.stringify([todoId, parent?.id ?? null, contents]);

  if (current?.fingerprint === fingerprint) {
    return current;
  }

  return {
    fingerprint,
    variables: createWriteTodoCommentsCommand(parent, contents),
  };
}

export function createWriteTodoCommentsCommand(
  parent: TodoComment | null,
  contents: readonly [string, ...string[]],
): CreateTodoCommentChainInput {
  const [first, ...rest] = contents;
  const toItem = (content: string): CreateTodoCommentChainInput['items'][number] => ({
    clientRequestId: Crypto.randomUUID(),
    content,
  });

  return {
    parentId: parent?.id ?? null,
    items: [toItem(first), ...rest.map(toItem)],
  };
}
