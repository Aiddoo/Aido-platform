import type { TodoCommentAuthor, TodoComment } from '../../models/todo-comment.model';

export type TodoCommentComposerSession =
  | { mode: 'create' }
  | { mode: 'reply'; target: TodoComment }
  | { mode: 'edit'; target: TodoComment };

export function toTodoCommentAuthor(
  user: { id: string; name: string | null; profileImage: string | null },
  ownerId: string,
): TodoCommentAuthor {
  return {
    id: user.id,
    name: user.name,
    profileImage: user.profileImage,
    isTodoOwner: user.id === ownerId,
  };
}
