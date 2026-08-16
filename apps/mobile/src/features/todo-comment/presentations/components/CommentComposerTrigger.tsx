import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, VStack } from '@src/shared/ui';
import { PressableFeedback } from 'heroui-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { TodoCommentAuthor } from '../../models/todo-comment.model';
import { CommentAuthorAvatar } from './CommentAuthorAvatar';

interface CommentComposerTriggerProps {
  /** 누구에게 다는지 — 없으면 할 일에 바로 다는 첫 댓글이다. */
  replyingTo: TodoCommentAuthor | null;
  isDisabled?: boolean;
  onPress: () => void;
}

/**
 * 화면 맨 아래에 놓이는 글쓰기 입구. 실제 입력은 눌렀을 때 뜨는 시트가 맡는다.
 * 여기서 직접 입력받지 않아 키보드를 다루지 않고, 그래서 시트의 키보드 처리와 부딪히지 않는다.
 */
export function CommentComposerTrigger({
  replyingTo,
  isDisabled,
  onPress,
}: CommentComposerTriggerProps) {
  const { t } = useTranslation('todoComment');
  const insets = useSafeAreaInsets();

  return (
    <VStack
      px={12}
      pt={8}
      style={{ paddingBottom: (insets.bottom || 16) + 4 }}
      className="border-t border-gray-2 bg-background"
    >
      <PressableFeedback onPress={onPress} isDisabled={isDisabled}>
        <HStack
          gap={10}
          align="center"
          className="min-h-14 rounded-3xl border border-gray-3 bg-gray-2 px-4"
        >
          <CommentAuthorAvatar author={replyingTo} size="sm" />
          <Text size="b3" shade={5} className="flex-1">
            {replyingTo === null
              ? t('input.placeholder')
              : t('input.replyingTo', { name: replyingTo.name ?? t('list.unknownUser') })}
          </Text>
        </HStack>
      </PressableFeedback>
    </VStack>
  );
}
