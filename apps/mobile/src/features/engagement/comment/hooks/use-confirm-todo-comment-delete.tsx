import { useTodoId } from '@src/features/planning/todo/hooks/use-todo-params';
import { useTranslation } from '@src/shared/i18n';
import { useConfirmDialog } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { createContext, type PropsWithChildren, use } from 'react';
import { match } from 'ts-pattern';

import { isTodoCommentUnavailableError } from '../domains/todo-comment.error';
import { type TodoComment, TodoCommentPolicy } from '../domains/todo-comment.model';
import { useDeleteTodoCommentMutationOptions } from '../queries/todo-comment.mutations';
import { EMPTY_TODO_COMMENT_FORM_VALUES } from '../schemas/todo-comment-form.schema';
import { findComposerTarget } from '../utils/todo-comment-form.view-model';
import { useTodoCommentForm } from './use-todo-comment-form';

type ConfirmTodoCommentDelete = (comment: TodoComment) => Promise<void>;

const TodoCommentDeleteContext = createContext<ConfirmTodoCommentDelete | null>(null);

/**
 * 지운 댓글 행은 낙관적 갱신으로 바로 빠지거나 묘비로 바뀌어 메뉴가 내려간다. 행이 띄운 다이얼로그는 행과 함께
 * 사라지므로 행보다 오래 사는 세션이 띄워, 요청하는 동안 진행 중으로 남고 실패하면 행이 돌아온 뒤에도 남는다
 */
export function TodoCommentDeleteProvider({ children }: PropsWithChildren) {
  const { t } = useTranslation('todoComment');
  const [todoId] = useTodoId();
  const confirmDialog = useConfirmDialog();
  const { reset, getValues } = useTodoCommentForm();
  const { mutateAsync: deleteComment } = useMutation(
    useDeleteTodoCommentMutationOptions({ todoId }),
  );

  const confirmDelete = async (comment: TodoComment) => {
    await confirmDialog.openAsync({
      title: t('deleteConfirm.title'),
      description: match(comment)
        .when(TodoCommentPolicy.canDeleteOnlyAsTodoOwner, () =>
          t('deleteConfirm.othersDescription'),
        )
        .when(TodoCommentPolicy.isTombstonedOnDelete, () => t('deleteConfirm.tombstoneDescription'))
        .otherwise(() => t('deleteConfirm.description')),
      confirmLabel: t('deleteConfirm.confirm'),
      confirmColor: 'danger',
      cancelLabel: t('actions.cancel'),
      onConfirm: async () => {
        // 답글이나 수정 대상으로 고른 글을 지우면 작성기가 지운 글에 보내지 않게 비운다
        if (findComposerTarget(getValues('mode'))?.id === comment.id) {
          reset(EMPTY_TODO_COMMENT_FORM_VALUES);
        }
        try {
          await deleteComment({ comment });
        } catch (error) {
          // 이미 지워졌으면 지운 것과 같아 다이얼로그를 닫는다. 안내는 mutation이 했다
          if (!isTodoCommentUnavailableError(error)) {
            throw error;
          }
        }
      },
    });
  };

  return <TodoCommentDeleteContext value={confirmDelete}>{children}</TodoCommentDeleteContext>;
}

export function useConfirmTodoCommentDelete() {
  const confirmDelete = use(TodoCommentDeleteContext);
  if (confirmDelete == null) {
    throw new Error('useConfirmTodoCommentDelete must be used inside TodoCommentDeleteProvider');
  }

  return confirmDelete;
}
