import {
  type TodoCommentAuthor,
  type TodoComment,
  TodoCommentPolicy,
} from '../../domains/todo-comment.model';

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

export type TodoCommentFormUnavailableReason =
  | 'commentingDisabled'
  | 'replyUnavailable'
  | 'editUnavailable';

interface TodoCommentFormAvailabilityParams {
  formType: 'reply' | 'edit';
  target: TodoComment;
  canComment: boolean;
}

export function getTodoCommentFormUnavailableReason({
  formType,
  target,
  canComment,
}: TodoCommentFormAvailabilityParams): TodoCommentFormUnavailableReason | null {
  if (formType === 'reply') {
    if (!canComment) {
      return 'commentingDisabled';
    }
    return TodoCommentPolicy.canReply(target) ? null : 'replyUnavailable';
  }

  return TodoCommentPolicy.canEdit(target) ? null : 'editUnavailable';
}

export function getTodoCommentInputLayoutIdentity(
  commentRoute:
    | { view: 'overview'; form: { type: string } | null }
    | { view: 'conversation'; commentId: string; form: { type: string } | null },
): string {
  const formType = commentRoute.form?.type ?? 'reading';

  return commentRoute.view === 'overview'
    ? `overview:${formType}`
    : `conversation:${commentRoute.commentId}:${formType}`;
}
