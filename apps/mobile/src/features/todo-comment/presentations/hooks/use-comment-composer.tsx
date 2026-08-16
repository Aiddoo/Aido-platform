import { useTodoScreenParams } from '@src/features/todo/presentations/hooks/use-todo-screen-params';
import { useOverlay } from '@src/shared/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { TodoComment, TodoCommentPreview } from '../../models/todo-comment.model';
import { CommentComposerSheet } from '../components/CommentComposerSheet';
import {
  findMyAuthorProfile,
  useUpdateTodoCommentMutationOptions,
  useWriteTodoCommentsMutationOptions,
} from '../queries/use-todo-comment-mutation-options';
import { useCommentSort } from './use-comment-sort';

/** 시트가 닫힐 때 돌려주는 값. 취소하면 비어 있다. */
export interface CommentComposerResult {
  written: TodoComment[];
}

/**
 * 글을 쓰는 시트를 여는 유일한 입구.
 *
 * 어디서 열든 같은 시트가 뜨고, 무엇을 쓰는지는 부르는 쪽이 정한다.
 * 돌려주는 Promise로 방금 쓴 글을 받아 목록 위치를 맞출 수 있다.
 */
export function useCommentComposer() {
  const overlay = useOverlay();
  const { todoId } = useTodoScreenParams();
  const [sort] = useCommentSort();
  const queryClient = useQueryClient();
  const author = findMyAuthorProfile(queryClient, todoId) ?? null;

  const writeComments = useMutation(useWriteTodoCommentsMutationOptions(todoId, sort));
  const updateComment = useMutation(useUpdateTodoCommentMutationOptions(todoId));

  const closeOnCancel = (close: (result: CommentComposerResult) => void, exit: () => void) => {
    return (open: boolean) => {
      if (!open) {
        close({ written: [] });
        exit();
      }
    };
  };

  return {
    /** 할 일에 바로 다는 첫 댓글 */
    writeComment: () =>
      overlay.open<CommentComposerResult>(({ isOpen, close, exit }) => (
        <CommentComposerSheet
          author={author}
          target={null}
          isOpen={isOpen}
          isSubmitting={writeComments.isPending}
          onOpenChange={closeOnCancel(close, exit)}
          onSubmit={(contents) =>
            writeComments.mutate(
              { parentId: null, draft: { contents } },
              { onSuccess: ({ comments }) => close({ written: comments }) },
            )
          }
        />
      )),

    /** 이 댓글에 답글 달기 */
    replyTo: (target: TodoCommentPreview) =>
      overlay.open<CommentComposerResult>(({ isOpen, close, exit }) => (
        <CommentComposerSheet
          author={author}
          target={target}
          isOpen={isOpen}
          isSubmitting={writeComments.isPending}
          onOpenChange={closeOnCancel(close, exit)}
          onSubmit={(contents) =>
            writeComments.mutate(
              { parentId: target.id, draft: { contents } },
              { onSuccess: ({ comments }) => close({ written: comments }) },
            )
          }
        />
      )),

    /** 내가 쓴 글 고치기 */
    edit: (comment: TodoCommentPreview) =>
      overlay.open<CommentComposerResult>(({ isOpen, close, exit }) => (
        <CommentComposerSheet
          author={author}
          target={comment}
          defaultContent={comment.content ?? ''}
          isOpen={isOpen}
          isSubmitting={updateComment.isPending}
          onOpenChange={closeOnCancel(close, exit)}
          onSubmit={([content]) =>
            updateComment.mutate(
              { commentId: comment.id, input: { content } },
              { onSuccess: (updated) => close({ written: [updated] }) },
            )
          }
        />
      )),
  };
}
