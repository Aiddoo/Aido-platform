import {
  blockUserConfirmHref,
  commentReportSheetHref,
} from '@src/features/moderation/utils/navigation/moderation-href';
import { useTodoScreenParams } from '@src/features/todo/hooks/use-todo-screen-params';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import {
  Box,
  ChatBubbleIcon,
  HeartFilledIcon,
  HeartIcon,
  HStack,
  ICON_COUNT_BUTTON_ICON_SIZE,
  ICON_COUNT_BUTTON_INK_INSET,
  IconCountButton,
  MoreIcon,
  Text,
  TextSkeleton,
  useConfirmDialog,
  VStack,
} from '@src/shared/ui';
import { formatRelativeTime } from '@src/shared/utils/date';
import { useMutation } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { router } from 'expo-router';
import { Menu, PressableFeedback, Skeleton, Spinner } from 'heroui-native';
import { useRef, useState, type ComponentProps } from 'react';

import { type TodoComment, TodoCommentPolicy } from '../domains/todo-comment.model';
import { useTodoCommentNavigation } from '../hooks/use-todo-comment-navigation';
import { useDeleteTodoCommentMutationOptions } from '../queries/use-delete-todo-comment-mutation-options';
import { useSetTodoCommentLikeMutationOptions } from '../queries/use-set-todo-comment-like-mutation-options';

interface TodoCommentMessageProps {
  comment: TodoComment;
  isFocused?: boolean;
}

export function TodoCommentMessage({ comment, isFocused = false }: TodoCommentMessageProps) {
  const navigation = useTodoCommentNavigation(comment);
  const isActive = TodoCommentPolicy.isActive(comment);
  const { t } = useTranslation('todoComment');

  return (
    <HStack align="start" gap={8} className="min-w-0">
      <VStack gap={3} className="min-w-0 flex-1">
        <PressableFeedback
          onPress={navigation.openConversation}
          animation={false}
          isAnimatedStyleActive={false}
          accessibilityRole="button"
          accessibilityLabel={t('actions.openConversation')}
          accessibilityState={{ selected: isFocused }}
          className="min-h-11 min-w-0 justify-center overflow-visible rounded-xl"
        >
          <PressableFeedback.Highlight className="rounded-xl" />
          <VStack gap={3}>
            <CommentAuthorLine comment={comment} />
            <CommentBody comment={comment} />
          </VStack>
        </PressableFeedback>

        {isActive && (
          <VStack pt={2} ml={-ICON_COUNT_BUTTON_INK_INSET}>
            <HStack align="center">
              <CommentLikeButton comment={comment} />
              <CommentReplyButton
                comment={comment}
                isPreparing={navigation.isPreparing}
                canOpenReply={navigation.canStartReply}
                onPress={navigation.startReply}
              />
            </HStack>
          </VStack>
        )}
      </VStack>

      {/* 메뉴가 없는 댓글도 같은 폭을 남겨 본문 폭이 행마다 같게 한다 */}
      <Box className="size-11 shrink-0 items-center justify-center">
        {TodoCommentPolicy.hasActions(comment) && (
          <CommentActionMenu
            comment={comment}
            isEditPreparing={navigation.isPreparing}
            canOpenEdit={navigation.canStartEdit}
            onEdit={navigation.startEdit}
          />
        )}
      </Box>
    </HStack>
  );
}

TodoCommentMessage.Loading = function Loading() {
  return (
    <HStack align="start" gap={8} className="min-w-0">
      <VStack gap={3} className="min-w-0 flex-1">
        <Box className="min-h-11 justify-center">
          <VStack gap={3}>
            <HStack align="center" gap={4}>
              <TextSkeleton size="b4" className="w-24" />
              <TextSkeleton size="e1" className="ml-auto w-10" />
            </HStack>
            <TextSkeleton size="b3" className="w-4/5" />
          </VStack>
        </Box>
        <VStack pt={2} ml={-ICON_COUNT_BUTTON_INK_INSET}>
          <HStack align="center">
            {times(2, (index) => (
              <Box
                key={index}
                className="min-h-11 min-w-11 items-center justify-center px-2 py-1.5"
              >
                <Skeleton
                  className="rounded-full"
                  style={{
                    width: ICON_COUNT_BUTTON_ICON_SIZE,
                    height: ICON_COUNT_BUTTON_ICON_SIZE,
                  }}
                />
              </Box>
            ))}
          </HStack>
        </VStack>
      </VStack>
      <Box className="size-11 shrink-0" />
    </HStack>
  );
};

/**
 * 이름만 말줄임되고 태그·작성자 배지·시간은 줄지 않는다. 가장 큰 글자에서는 한 줄에 다 담기지 않아
 * 태그와 시간을 둘째 줄로 내린다.
 */
function CommentAuthorLine({ comment }: { comment: TodoComment }) {
  const { t } = useTranslation('todoComment');
  const { fontScale } = useFontScale();
  const userTag = comment.author?.userTag;
  const tagLabel = userTag == null ? null : `#${userTag}`;
  const timeLabel = [
    formatRelativeTime(comment.createdAt, new Date()),
    ...(comment.isEdited ? [t('list.edited')] : []),
  ].join(' · ');
  const isMetaOnSecondLine = fontScale === 'xlarge';

  return (
    <VStack gap={1} className="min-w-0">
      <HStack gap={4} align="baseline" className="min-w-0">
        <Text size="b4" weight="semibold" maxLines={1} className="min-w-0 shrink">
          {comment.author?.name ?? t('list.unknownUser')}
        </Text>
        {!isMetaOnSecondLine && tagLabel != null && (
          <Text size="e1" shade={7} className="shrink-0">
            {tagLabel}
          </Text>
        )}
        {comment.author?.isTodoOwner === true && (
          <Text size="e2" tone="brand" className="shrink-0">
            {t('list.authorBadge')}
          </Text>
        )}
        {!isMetaOnSecondLine && (
          <Text size="e1" shade={7} className="ml-auto shrink-0 pl-2 tabular-nums">
            {timeLabel}
          </Text>
        )}
      </HStack>
      {isMetaOnSecondLine && (
        <Text size="e1" shade={7} className="tabular-nums">
          {[tagLabel, timeLabel].filter((label) => label != null).join(' · ')}
        </Text>
      )}
    </VStack>
  );
}

function CommentBody({ comment }: { comment: TodoComment }) {
  const { t } = useTranslation('todoComment');
  const mention = comment.replyTo?.authorName;

  if (comment.isDeleted) {
    return (
      <Text size="b4" shade={6}>
        {comment.isAuthorBlocked ? t('list.blockedAuthor') : t('list.deleted')}
      </Text>
    );
  }
  return (
    <HStack gap={4} className="min-w-0 flex-wrap">
      {mention != null && (
        <Text
          size="b3"
          tone="brand"
          maxLines={1}
          ellipsizeMode="tail"
          className="max-w-full shrink"
        >
          {`@${mention}`}
        </Text>
      )}
      <Text size="b3" shade={9} className="min-w-0 flex-1">
        {comment.content}
      </Text>
    </HStack>
  );
}
interface CommentActionMenuProps {
  comment: TodoComment;
  isEditPreparing: boolean;
  canOpenEdit: boolean;
  onEdit: () => void;
}

function CommentActionMenu({
  comment,
  isEditPreparing,
  canOpenEdit,
  onEdit,
}: CommentActionMenuProps) {
  const { todoId } = useTodoScreenParams();
  const { t } = useTranslation(['todoComment', 'moderation']);
  const push = useSingleTap(router.push);
  const deleteComment = useMutation(useDeleteTodoCommentMutationOptions({ todoId }));
  const [isOpen, setIsOpen] = useState(false);
  const confirmDialog = useConfirmDialog();
  const author = comment.author;

  // 내 댓글은 바로 지우고, 내 할 일에 달린 남의 댓글은 모두에게서 사라진다는 것을 확인받는다
  const handleDelete = async () => {
    if (TodoCommentPolicy.isDeletingOthers(comment)) {
      const isConfirmed = await confirmDialog.open({
        title: t('deleteOthersConfirm.title'),
        description: t('deleteOthersConfirm.description'),
        confirmLabel: t('deleteOthersConfirm.confirm'),
        confirmColor: 'danger',
        cancelLabel: t('actions.cancel'),
      });
      if (!isConfirmed) {
        return;
      }
    }
    deleteComment.mutate({ commentId: comment.id });
  };

  return (
    <Menu isOpen={isOpen} onOpenChange={setIsOpen}>
      <Menu.Trigger asChild>
        <PressableFeedback
          hitSlop={10}
          className="min-h-11 min-w-11 items-center justify-center py-1"
          isDisabled={deleteComment.isPending}
          accessibilityRole="button"
          accessibilityLabel={t('actions.more')}
          accessibilityState={{
            expanded: isOpen,
            busy: deleteComment.isPending,
            disabled: deleteComment.isPending,
          }}
        >
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
            <Menu.Item isDisabled={isEditPreparing || !canOpenEdit} onPress={onEdit}>
              <Menu.ItemTitle>{t('actions.edit')}</Menu.ItemTitle>
            </Menu.Item>
          )}
          {TodoCommentPolicy.canDelete(comment) && (
            <Menu.Item variant="danger" isDisabled={deleteComment.isPending} onPress={handleDelete}>
              <Menu.ItemTitle>{t('actions.delete')}</Menu.ItemTitle>
            </Menu.Item>
          )}
          {TodoCommentPolicy.canReport(comment) && (
            <Menu.Item
              onPress={() => push(commentReportSheetHref({ todoId, commentId: comment.id }))}
            >
              <Menu.ItemTitle>{t('actions.report')}</Menu.ItemTitle>
            </Menu.Item>
          )}
          {author != null && TodoCommentPolicy.canBlockAuthor(comment) && (
            <Menu.Item
              variant="danger"
              onPress={() =>
                push(
                  blockUserConfirmHref({
                    userId: author.id,
                    displayName: author.name ?? t('moderation:fallbackName'),
                  }),
                )
              }
            >
              <Menu.ItemTitle>{t('actions.block')}</Menu.ItemTitle>
            </Menu.Item>
          )}
        </Menu.Content>
      </Menu.Portal>
    </Menu>
  );
}

interface CommentLikeButtonProps extends Omit<
  ComponentProps<typeof IconCountButton>,
  'icon' | 'count' | 'onPress' | 'isDisabled' | 'accessibilityRole' | 'accessibilityState'
> {
  comment: TodoComment;
}

function CommentLikeButton({ comment, ...buttonProps }: CommentLikeButtonProps) {
  const { todoId } = useTodoScreenParams();
  const { t } = useTranslation('todoComment');
  const likeComment = useMutation(useSetTodoCommentLikeMutationOptions({ todoId }));
  const submissionGateRef = useRef(false);

  return (
    <IconCountButton
      {...buttonProps}
      accessibilityRole="button"
      icon={
        comment.viewer.isLiked ? (
          <HeartFilledIcon
            width={ICON_COUNT_BUTTON_ICON_SIZE}
            height={ICON_COUNT_BUTTON_ICON_SIZE}
            colorClassName="text-error"
          />
        ) : (
          <HeartIcon
            width={ICON_COUNT_BUTTON_ICON_SIZE}
            height={ICON_COUNT_BUTTON_ICON_SIZE}
            colorClassName="text-gray-6"
          />
        )
      }
      count={comment.likeCount}
      countDisplay="compact"
      isDisabled={!TodoCommentPolicy.canLike(comment) || likeComment.isPending}
      accessibilityLabel={
        buttonProps.accessibilityLabel ??
        (comment.viewer.isLiked
          ? t('actions.unlikeWithCount', { count: comment.likeCount })
          : t('actions.likeWithCount', { count: comment.likeCount }))
      }
      accessibilityState={{
        selected: comment.viewer.isLiked,
        disabled: !TodoCommentPolicy.canLike(comment) || likeComment.isPending,
        busy: likeComment.isPending,
      }}
      onPress={() => {
        if (submissionGateRef.current) {
          return;
        }

        submissionGateRef.current = true;
        likeComment.mutate(
          { commentId: comment.id, isLiked: !comment.viewer.isLiked },
          {
            onSettled: () => {
              submissionGateRef.current = false;
            },
          },
        );
      }}
    />
  );
}

interface CommentReplyButtonProps extends Omit<
  ComponentProps<typeof IconCountButton>,
  | 'icon'
  | 'count'
  | 'onPress'
  | 'isDisabled'
  | 'accessibilityRole'
  | 'accessibilityLabel'
  | 'accessibilityState'
> {
  comment: TodoComment;
  isPreparing: boolean;
  canOpenReply: boolean;
  onPress: () => void;
}

function CommentReplyButton({
  comment,
  isPreparing,
  canOpenReply,
  onPress,
  ...buttonProps
}: CommentReplyButtonProps) {
  const { t } = useTranslation('todoComment');
  const canReply = TodoCommentPolicy.canReply(comment);
  const isDisabled = !canReply || isPreparing || !canOpenReply;
  const authorName = comment.author?.name ?? t('list.unknownUser');

  return (
    <IconCountButton
      {...buttonProps}
      accessibilityRole="button"
      icon={
        isPreparing ? (
          <Box accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Spinner size="sm" />
          </Box>
        ) : (
          <ChatBubbleIcon
            width={ICON_COUNT_BUTTON_ICON_SIZE}
            height={ICON_COUNT_BUTTON_ICON_SIZE}
            colorClassName="text-gray-6"
          />
        )
      }
      count={comment.replyCount}
      countDisplay="compact"
      isDisabled={isDisabled}
      accessibilityLabel={t('actions.replyWithCount', {
        name: authorName,
        count: comment.replyCount,
      })}
      accessibilityState={{ busy: isPreparing, disabled: isDisabled }}
      onPress={onPress}
    />
  );
}
