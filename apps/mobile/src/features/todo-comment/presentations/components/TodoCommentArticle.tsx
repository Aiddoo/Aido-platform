import { useTodoScreenParams } from '@src/features/todo/presentations/hooks/use-todo-screen-params';
import { useTranslation } from '@src/shared/i18n';
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
  VStack,
} from '@src/shared/ui';
import { formatRelativeTime } from '@src/shared/utils/date';
import { useMutation } from '@tanstack/react-query';
import { Menu, PressableFeedback, Spinner } from 'heroui-native';
import { useRef, useState, type ComponentProps } from 'react';

import { type TodoComment, TodoCommentPolicy } from '../../models/todo-comment.model';
import { useCommentConversationNavigation } from '../hooks/use-comment-conversation-navigation';
import { useDeleteTodoCommentMutationOptions } from '../queries/use-delete-todo-comment-mutation-options';
import { useSetTodoCommentLikeMutationOptions } from '../queries/use-set-todo-comment-like-mutation-options';

interface TodoCommentArticleProps {
  comment: TodoComment;
  isFocused?: boolean;
}

export function TodoCommentArticle({ comment, isFocused = false }: TodoCommentArticleProps) {
  const navigation = useCommentConversationNavigation(comment);
  const canAct = TodoCommentPolicy.canAct(comment);
  const { t } = useTranslation('todoComment');

  return (
    <VStack flex={1} gap={3}>
      <HStack align="start" justify="between" gap={8} className="min-w-0">
        <PressableFeedback
          onPress={() => navigation.openThread().catch(() => undefined)}
          accessibilityRole="button"
          accessibilityLabel={t('actions.openConversation')}
          accessibilityState={{ selected: isFocused }}
          className="min-h-11 min-w-0 flex-1 justify-center rounded-xl"
        >
          <VStack gap={3}>
            <CommentAuthorLine comment={comment} />
            <CommentText comment={comment} />
          </VStack>
        </PressableFeedback>
        {canAct && (
          <Box className="shrink-0">
            <CommentActionMenu
              comment={comment}
              isEditPreparing={navigation.isPreparing}
              isNavigationBlocked={navigation.isNavigationBlocked}
              onEdit={() => navigation.openEdit().catch(() => undefined)}
            />
          </Box>
        )}
      </HStack>

      {canAct && (
        <VStack pt={2} ml={-ICON_COUNT_BUTTON_INK_INSET}>
          <HStack align="center">
            <CommentLikeButton comment={comment} />
            <CommentReplyButton
              comment={comment}
              isPreparing={navigation.isPreparing}
              isNavigationBlocked={navigation.isNavigationBlocked}
              onPress={() => navigation.openReply().catch(() => undefined)}
            />
          </HStack>
        </VStack>
      )}
    </VStack>
  );
}

function CommentAuthorLine({ comment }: { comment: TodoComment }) {
  const { t } = useTranslation('todoComment');

  return (
    <HStack gap={4} align="center" className="min-w-0 flex-1 flex-wrap">
      <Text
        size="b4"
        weight="semibold"
        maxLines={1}
        ellipsizeMode="tail"
        className="max-w-full shrink"
      >
        {comment.author?.name ?? t('list.unknownUser')}
      </Text>
      {comment.author?.isTodoOwner === true && (
        <Text size="e2" tone="brand">
          {t('list.authorBadge')}
        </Text>
      )}
      <Text size="e1" shade={5}>
        {formatRelativeTime(comment.createdAt)}
      </Text>
      {comment.isEdited && (
        <Text size="e1" shade={5}>
          {t('list.edited')}
        </Text>
      )}
    </HStack>
  );
}

function CommentText({ comment }: { comment: TodoComment }) {
  const { t } = useTranslation('todoComment');
  const mention = comment.replyTo?.authorName ?? null;

  if (comment.isDeleted) {
    return (
      <Text size="b4" shade={6}>
        {t('list.deleted')}
      </Text>
    );
  }
  return (
    <HStack gap={4} className="min-w-0 flex-wrap">
      {mention !== null && (
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
  isNavigationBlocked: boolean;
  onEdit: () => void;
}

function CommentActionMenu({
  comment,
  isEditPreparing,
  isNavigationBlocked,
  onEdit,
}: CommentActionMenuProps) {
  const { todoId } = useTodoScreenParams();
  const { t } = useTranslation('todoComment');
  const deleteComment = useMutation(useDeleteTodoCommentMutationOptions(todoId));
  const [isOpen, setIsOpen] = useState(false);

  if (!TodoCommentPolicy.canManage(comment)) {
    return null;
  }

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
            <Menu.Item isDisabled={isEditPreparing || isNavigationBlocked} onPress={onEdit}>
              <Menu.ItemTitle>{t('actions.edit')}</Menu.ItemTitle>
            </Menu.Item>
          )}
          {TodoCommentPolicy.canDelete(comment) && (
            <Menu.Item
              variant="danger"
              isDisabled={deleteComment.isPending}
              onPress={() => {
                deleteComment.mutateAsync({ comment }).catch(() => undefined);
              }}
            >
              <Menu.ItemTitle>{t('actions.delete')}</Menu.ItemTitle>
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
  const likeComment = useMutation(useSetTodoCommentLikeMutationOptions(todoId));
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
        likeComment
          .mutateAsync({ commentId: comment.id, isLiked: !comment.viewer.isLiked })
          .catch(() => undefined)
          .finally(() => {
            submissionGateRef.current = false;
          });
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
  isNavigationBlocked: boolean;
  onPress: () => void;
}

function CommentReplyButton({
  comment,
  isPreparing,
  isNavigationBlocked,
  onPress,
  ...buttonProps
}: CommentReplyButtonProps) {
  const { t } = useTranslation('todoComment');
  const canReply = TodoCommentPolicy.canReply(comment);
  const isDisabled = !canReply || isPreparing || isNavigationBlocked;
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
