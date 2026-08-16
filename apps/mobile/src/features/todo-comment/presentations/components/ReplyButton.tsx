import { useTranslation } from '@src/shared/i18n';
import { ChatBubbleIcon, ICON_COUNT_BUTTON_ICON_SIZE, IconCountButton } from '@src/shared/ui';

import { type TodoCommentPreview, TodoCommentPolicy } from '../../models/todo-comment.model';
import { useCommentComposer } from '../hooks/use-comment-composer';
import { useCommentRowScroll } from '../hooks/use-comment-row-scroll';

interface ReplyButtonProps {
  comment: TodoCommentPreview;
}

/**
 * 이 댓글에 답글을 단다. 깊이와 상관없이 어느 댓글에나 달 수 있고, 화면은 그대로 있는다.
 * 답글이 몇 개인지는 숫자로 알리고, 그 답글들을 읽으러 가는 길은 맛보기가 맡는다.
 */
export function ReplyButton({ comment }: ReplyButtonProps) {
  const { t } = useTranslation('todoComment');
  const composer = useCommentComposer();
  const scrollRowToTop = useCommentRowScroll();

  return (
    <IconCountButton
      icon={
        <ChatBubbleIcon
          width={ICON_COUNT_BUTTON_ICON_SIZE}
          height={ICON_COUNT_BUTTON_ICON_SIZE}
          colorClassName="text-gray-6"
        />
      }
      count={comment.replyCount}
      isDisabled={!TodoCommentPolicy.canReply(comment)}
      accessibilityLabel={t('actions.reply')}
      onPress={() => {
        scrollRowToTop(comment.id);
        composer.replyTo(comment);
      }}
    />
  );
}
