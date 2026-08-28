import type { TodoCommentAuthor, TodoComment } from '../../models/todo-comment.model';

export type TodoCommentFormSession =
  | { type: 'new' }
  | { type: 'reply'; target: TodoComment }
  | { type: 'edit'; target: TodoComment };

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
