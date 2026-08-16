import { useTranslation } from '@src/shared/i18n';
import { MoreIcon } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { Menu, PressableFeedback } from 'heroui-native';

import { type TodoCommentPreview, TodoCommentPolicy } from '../../models/todo-comment.model';
import { useCommentComposer } from '../hooks/use-comment-composer';
import { useDeleteTodoCommentMutationOptions } from '../queries/use-todo-comment-mutation-options';

interface CommentActionMenuProps {
  comment: TodoCommentPreview;
}

/**
 * 내 댓글에만 뜨는 ⋯ 메뉴. 삭제 뮤테이션을 여기서 소유한다.
 * 수정은 이 자리에서 열지 않고 글 쓰는 시트로 넘긴다 — 앱에서 글을 쓰는 자리는 하나다.
 */
export function CommentActionMenu({ comment }: CommentActionMenuProps) {
  const { t } = useTranslation('todoComment');
  const composer = useCommentComposer();
  const deleteComment = useMutation(useDeleteTodoCommentMutationOptions(comment.todoId));

  if (!TodoCommentPolicy.canManage(comment)) {
    return null;
  }

  return (
    <Menu>
      <Menu.Trigger asChild>
        <PressableFeedback hitSlop={10} className="py-1">
          <MoreIcon width={18} height={18} colorClassName="text-gray-6" />
        </PressableFeedback>
      </Menu.Trigger>
      <Menu.Portal disableFullWindowOverlay={false}>
        <Menu.Overlay />
        <Menu.Content
          presentation="popover"
          placement="bottom"
          align="end"
          width={180}
          className="rounded-2xl border border-gray-2 bg-gray-1"
        >
          {TodoCommentPolicy.canEdit(comment) && (
            <Menu.Item onPress={() => composer.edit(comment)}>
              <Menu.ItemTitle>{t('actions.edit')}</Menu.ItemTitle>
            </Menu.Item>
          )}
          {TodoCommentPolicy.canDelete(comment) && (
            <Menu.Item variant="danger" onPress={() => deleteComment.mutate({ comment })}>
              <Menu.ItemTitle>{t('actions.delete')}</Menu.ItemTitle>
            </Menu.Item>
          )}
        </Menu.Content>
      </Menu.Portal>
    </Menu>
  );
}
