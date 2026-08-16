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

  /**
   * 시트가 닫혔음을 알려 오는 유일한 통로 — 취소든 게시 후든 여기로 온다.
   * 게시가 이미 결과로 resolve했다면 Promise는 첫 값을 지키므로 이 호출은 무해하다.
   */
  const settleOnClose = (close: (result: CommentComposerResult) => void, exit: () => void) => {
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
          onOpenChange={settleOnClose(close, exit)}
          onSubmit={async (contents) => {
            const result = await writeComments
              .mutateAsync({ parentId: null, draft: { contents } })
              .catch(() => null);

            if (result) {
              close({ written: result.comments });
            }
          }}
        />
      )),

    /** 이 댓글에 답글 달기 */
    replyTo: (target: TodoCommentPreview) =>
      overlay.open<CommentComposerResult>(({ isOpen, close, exit }) => (
        <CommentComposerSheet
          author={author}
          target={target}
          isOpen={isOpen}
          onOpenChange={settleOnClose(close, exit)}
          onSubmit={async (contents) => {
            const result = await writeComments
              .mutateAsync({ parentId: target.id, draft: { contents } })
              .catch(() => null);

            if (result) {
              close({ written: result.comments });
            }
          }}
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
          onOpenChange={settleOnClose(close, exit)}
          onSubmit={async ([content]) => {
            const updated = await updateComment
              .mutateAsync({ commentId: comment.id, input: { content } })
              .catch(() => null);

            if (updated) {
              close({ written: [updated] });
            }
          }}
        />
      )),
  };
}
