import { useClipboard, useLogger } from '@src/bootstrap/providers/di-context';
import { usePendingCoachmark } from '@src/features/device/coachmark/hooks/use-pending-coachmark';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import { useTodoScreenParams } from '@src/features/planning/todo/hooks/use-todo-screen-params';
import { useTrack } from '@src/shared/analytics';
import { formatRelativeTimeLabel } from '@src/shared/date/date-labels';
import { getErrorMessage } from '@src/shared/errors';
import { useAppToast } from '@src/shared/hooks/use-app-toast';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useReduceMotion } from '@src/shared/hooks/use-reduce-motion';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  MenuActionItem,
  BlockIcon,
  Box,
  CopyIcon,
  EditIcon,
  FlagIcon,
  HeartFilledIcon,
  HeartIcon,
  HStack,
  ICON_COUNT_BUTTON_ICON_SIZE,
  ICON_COUNT_BUTTON_INK_INSET,
  IconCountButton,
  MoreIcon,
  Text,
  TextSkeleton,
  TrashIcon,
  useConfirmDialog,
  VStack,
} from '@src/shared/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { compact } from 'es-toolkit';
import { router } from 'expo-router';
import { Menu, PressableFeedback, Separator, Skeleton } from 'heroui-native';
import { type ComponentRef, type ReactNode, type RefObject, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { match } from 'ts-pattern';

import { TODO_COMMENT_LOG_EVENT } from '../constants/todo-comment-log-events';
import {
  type TodoCommentComposerForm,
  TodoCommentComposer,
} from '../domains/todo-comment-composer.model';
import { type TodoComment, TodoCommentPolicy } from '../domains/todo-comment.model';
import { useCommentDoubleTap } from '../hooks/use-comment-double-tap';
import {
  useDeleteTodoCommentMutationOptions,
  useSetTodoCommentLikeMutationOptions,
} from '../queries/todo-comment.mutations';
import { TodoCommentAuthorAvatar } from './todo-comment-author-avatar';
import {
  popTodoCommentLikeButton,
  TodoCommentHeartBurst,
  useTodoCommentHeartBurstValues,
} from './todo-comment-heart-burst';
import { useTodoCommentReveal } from './todo-comment-reveal';

const MENU_TRIGGER_ICON_SIZE = 18;

const MENU_WIDTH = 200;
const MORE_HIT_SLOP = 12;

interface TodoCommentItemProps {
  comment: TodoComment;
}

/**
 * 댓글·답글 한 줄. 아바타 열은 글자 크기와 상관없이 고정이고, 본문은 두 번 탭하면 하트, 길게 누르면 ⋯ 메뉴다.
 * 바깥 여백과 연결선은 부모가 정한다.
 */
export function TodoCommentItem({ comment }: TodoCommentItemProps) {
  const rowRef = useRef<ComponentRef<typeof View>>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const likeButtonScale = useSharedValue(1);
  const displayState = TodoCommentPolicy.getDisplayState(comment);

  return (
    <View ref={rowRef} collapsable={false}>
      <HStack gap={12} align="start" className="min-w-0">
        <TodoCommentAuthorAvatar
          author={comment.author}
          size={TodoCommentPolicy.isReply(comment) ? 'sm' : 'md'}
          className={displayState === 'active' ? undefined : 'opacity-40'}
        />
        <VStack gap={3} flex={1} className="min-w-0">
          {match(displayState)
            .with('active', () => (
              <>
                <AuthorLine
                  comment={comment}
                  menu={
                    <ActionMenu
                      comment={comment}
                      rowRef={rowRef}
                      isOpen={isMenuOpen}
                      onOpenChange={setIsMenuOpen}
                    />
                  }
                />
                <Body
                  comment={comment}
                  likeButtonScale={likeButtonScale}
                  onLongPress={() => setIsMenuOpen(true)}
                />
                <HStack align="center" style={{ marginStart: -ICON_COUNT_BUTTON_INK_INSET }}>
                  <LikeButton comment={comment} scale={likeButtonScale} />
                  <ReplyButton comment={comment} rowRef={rowRef} />
                </HStack>
              </>
            ))
            .with('deleted', 'blockedAuthor', (state) => <Placeholder state={state} />)
            .exhaustive()}
        </VStack>
      </HStack>
    </View>
  );
}

TodoCommentItem.Loading = function Loading({ isReply = false }: { isReply?: boolean }) {
  return (
    <HStack gap={12} align="start" className="min-w-0">
      <Skeleton className={isReply ? 'size-7 rounded-full' : 'size-9 rounded-full'} />
      <VStack gap={6} flex={1} className="min-w-0 py-1">
        <TextSkeleton size="b4" className="w-28" />
        <TextSkeleton size="b3" className="w-4/5" />
        <TextSkeleton size="e1" className="w-16" />
      </VStack>
    </HStack>
  );
};

function useCommentTimeLabel(comment: TodoComment) {
  const { t } = useTranslation('todoComment');
  const now = useMinuteNow();
  const dateFormatContext = useDateFormatContext();

  return compact([
    formatRelativeTimeLabel(comment.createdAt, now, dateFormatContext),
    comment.isEdited ? t('list.edited') : null,
  ]).join(' · ');
}

/**
 * 이름·#태그·작성자 표시·시간은 한 줄에 놓다가 모자라면 줄바꿈하고, ⋯는 첫 줄 끝에 둔다.
 * 폭을 재서 나누지 않아 첫 화면 뒤에 줄 수가 바뀌며 밀리지 않는다.
 */
function AuthorLine({ comment, menu }: { comment: TodoComment; menu: ReactNode }) {
  const { t } = useTranslation('todoComment');
  const timeLabel = useCommentTimeLabel(comment);
  const tagLabel = TodoCommentPolicy.getUserTagLabel(comment);
  const name = comment.author?.name ?? t('list.unknownUser');

  return (
    <HStack gap={4} align="start" className="min-w-0">
      <HStack wrap="wrap" gap={4} align="center" className="min-w-0 flex-1 gap-y-px">
        <Text size="b4" weight="semibold" maxLines={1} ellipsizeMode="tail" className="max-w-full">
          {name}
        </Text>
        {tagLabel != null && <Meta text={tagLabel} isShrinkable />}
        {TodoCommentPolicy.isByTodoOwner(comment) && (
          <Text size="e2" tone="brand" className="shrink-0">
            {t('list.authorBadge')}
          </Text>
        )}
        <Meta text={`· ${timeLabel}`} />
      </HStack>
      <Box className="shrink-0">{menu}</Box>
    </HStack>
  );
}

function Meta({ text, isShrinkable = false }: { text: string; isShrinkable?: boolean }) {
  return (
    <Text
      size="e1"
      shade={7}
      maxLines={1}
      ellipsizeMode="tail"
      className={isShrinkable ? 'min-w-0 shrink' : 'shrink-0 tabular-nums'}
    >
      {text}
    </Text>
  );
}

function Body({
  comment,
  likeButtonScale,
  onLongPress,
}: {
  comment: TodoComment;
  likeButtonScale: SharedValue<number>;
  onLongPress: () => void;
}) {
  const { t } = useTranslation('todoComment');
  const { todoId } = useTodoScreenParams();
  const burst = useTodoCommentHeartBurstValues();
  const likeComment = useMutation(
    useSetTodoCommentLikeMutationOptions({ todoId, commentId: comment.id }),
  );
  const completeDoubleTapHint = useCompleteDoubleTapHint();
  const mention = TodoCommentPolicy.getMentionName(comment);
  const gesture = useCommentDoubleTap({
    burst,
    likeButtonScale,
    canLike: TodoCommentPolicy.canLikeComment(comment),
    onDoubleTap: () => {
      completeDoubleTapHint();
      // 이미 좋아요면 하트만 다시 보이고 요청은 보내지 않는다
      if (!comment.viewer.isLiked) {
        likeComment.mutate({ isLiked: true, via: 'double_tap' });
      }
    },
    onLongPress: () => {
      if (TodoCommentPolicy.hasCommentActions(comment)) {
        onLongPress();
      }
    },
  });

  return (
    <GestureDetector gesture={gesture}>
      <View
        collapsable={false}
        accessible
        accessibilityHint={t('actions.doubleTapToLike')}
        testID={`todo-comment-body-${comment.id}`}
      >
        <Text size="b3" shade={9}>
          {mention != null && <Text size="b3" tone="brand">{`@${mention} `}</Text>}
          {comment.content}
        </Text>
        <TodoCommentHeartBurst burst={burst} />
      </View>
    </GestureDetector>
  );
}

function useCompleteDoubleTapHint() {
  const { data: user } = useQuery(useGetMeQueryOptions());
  const { trackEvent } = useTrack();
  const [isPending, complete] = usePendingCoachmark({
    accountId: user?.id ?? '',
    kind: 'comment-double-tap',
  });

  return () => {
    if (user == null || !isPending) {
      return;
    }
    complete();
    trackEvent('todo_comment_hint_dismissed', { kind: 'double_tap', reason: 'used' });
  };
}

function Placeholder({ state }: { state: 'deleted' | 'blockedAuthor' }) {
  const { t } = useTranslation('todoComment');

  return (
    <Box className="min-h-9 justify-center">
      <Text size="b4" shade={6}>
        {match(state)
          .with('deleted', () => t('list.deleted'))
          .with('blockedAuthor', () => t('list.blockedAuthor'))
          .exhaustive()}
      </Text>
    </Box>
  );
}

function LikeButton({ comment, scale }: { comment: TodoComment; scale: SharedValue<number> }) {
  const { t } = useTranslation('todoComment');
  const { todoId } = useTodoScreenParams();
  const isReducedMotion = useReduceMotion();
  const likeComment = useMutation(
    useSetTodoCommentLikeMutationOptions({ todoId, commentId: comment.id }),
  );
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const isLiked = comment.viewer.isLiked;

  return (
    <IconCountButton
      accessibilityRole="button"
      testID={`todo-comment-like-${comment.id}`}
      icon={
        <Animated.View style={iconStyle}>
          {isLiked ? (
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
          )}
        </Animated.View>
      }
      count={comment.likeCount}
      countDisplay="compact"
      isDisabled={!TodoCommentPolicy.canLikeComment(comment)}
      accessibilityLabel={
        isLiked
          ? t('actions.unlikeWithCount', { count: comment.likeCount })
          : t('actions.likeWithCount', { count: comment.likeCount })
      }
      accessibilityState={{ selected: isLiked }}
      onPress={() => {
        if (!isLiked && !isReducedMotion) {
          popTodoCommentLikeButton(scale);
        }
        likeComment.mutate({ isLiked: !isLiked, via: 'button' });
      }}
    />
  );
}

function ReplyButton({
  comment,
  rowRef,
}: {
  comment: TodoComment;
  rowRef: RefObject<ComponentRef<typeof View> | null>;
}) {
  const { t } = useTranslation('todoComment');
  const { todoId } = useTodoScreenParams();
  const { trackEvent } = useTrack();
  const { reset } = useFormContext<TodoCommentComposerForm>();
  const { reveal } = useTodoCommentReveal();

  if (!TodoCommentPolicy.canReplyToComment(comment)) {
    return null;
  }

  return (
    <PressableFeedback
      className="min-h-11 justify-center px-2"
      accessibilityRole="button"
      accessibilityLabel={t('actions.replyTo', {
        name: comment.author?.name ?? t('list.unknownUser'),
      })}
      testID={`todo-comment-reply-${comment.id}`}
      onPress={() => {
        reset(TodoCommentComposer.reply(comment));
        trackEvent('todo_comment_reply_started', {
          todo_id: todoId,
          target: TodoCommentPolicy.isReply(comment) ? 'reply' : 'comment',
        });
        reveal(rowRef);
      }}
    >
      <Text size="e1" shade={7} weight="medium">
        {t('actions.reply')}
      </Text>
    </PressableFeedback>
  );
}

interface ActionMenuProps {
  comment: TodoComment;
  rowRef: RefObject<ComponentRef<typeof View> | null>;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

/** ⋯와 길게 누르기가 같은 메뉴를 연다. 내 글은 수정·복사·삭제, 남의 글은 복사·신고·차단이다 */
function ActionMenu({ comment, rowRef, isOpen, onOpenChange }: ActionMenuProps) {
  const { todoId } = useTodoScreenParams();
  const { t } = useTranslation(['todoComment', 'moderation']);
  const push = useSingleTap(router.push);
  const clipboard = useClipboard();
  const logger = useLogger();
  const toast = useAppToast();
  const confirmDialog = useConfirmDialog();
  const { reset } = useFormContext<TodoCommentComposerForm>();
  const { reveal } = useTodoCommentReveal();
  const deleteComment = useMutation(useDeleteTodoCommentMutationOptions({ todoId }));
  const author = comment.author;
  const authorName = author?.name ?? t('moderation:fallbackName');
  const hasPrimaryActions =
    TodoCommentPolicy.isEditableComment(comment) || TodoCommentPolicy.canCopyComment(comment);
  const hasSecondaryActions =
    TodoCommentPolicy.canDeleteComment(comment) ||
    TodoCommentPolicy.canReportComment(comment) ||
    TodoCommentPolicy.canBlockCommentAuthor(comment);

  if (!TodoCommentPolicy.hasCommentActions(comment)) {
    return null;
  }

  const copyContent = async () => {
    try {
      await clipboard.copy(comment.content ?? '');
      toast.success(t('toasts.copied'));
    } catch (error) {
      logger.warn(TODO_COMMENT_LOG_EVENT.COPY_FAILED, { error: getErrorMessage(error) });
      toast.error(undefined, { fallback: t('toasts.copyFailed') });
    }
  };

  const confirmDelete = async () => {
    const isConfirmed = await confirmDialog.open({
      title: t('deleteConfirm.title'),
      description: match(comment)
        .when(TodoCommentPolicy.isDeletingOthersComment, () => t('deleteConfirm.othersDescription'))
        .when(TodoCommentPolicy.leavesTombstoneOnDelete, () =>
          t('deleteConfirm.tombstoneDescription'),
        )
        .otherwise(() => t('deleteConfirm.description')),
      confirmLabel: t('deleteConfirm.confirm'),
      confirmColor: 'danger',
      cancelLabel: t('actions.cancel'),
    });
    if (isConfirmed) {
      deleteComment.mutate({ comment });
    }
  };

  return (
    <Menu isOpen={isOpen} onOpenChange={onOpenChange}>
      <Menu.Trigger asChild>
        <PressableFeedback
          hitSlop={MORE_HIT_SLOP}
          className="min-h-6 min-w-8 items-center justify-center"
          isDisabled={deleteComment.isPending}
          testID={`todo-comment-more-${comment.id}`}
          accessibilityRole="button"
          accessibilityLabel={t('actions.more')}
          accessibilityState={{ expanded: isOpen, busy: deleteComment.isPending }}
        >
          <MoreIcon
            width={MENU_TRIGGER_ICON_SIZE}
            height={MENU_TRIGGER_ICON_SIZE}
            colorClassName="text-gray-6"
          />
        </PressableFeedback>
      </Menu.Trigger>
      <Menu.Portal disableFullWindowOverlay={false}>
        <Menu.Overlay />
        <Menu.Content
          presentation="popover"
          placement="bottom"
          align="end"
          width={MENU_WIDTH}
          className="rounded-2xl border border-gray-2 bg-gray-1"
        >
          {TodoCommentPolicy.isEditableComment(comment) && (
            <MenuActionItem
              icon={EditIcon}
              title={t('actions.edit')}
              testID="todo-comment-edit"
              onPress={() => {
                reset(TodoCommentComposer.edit(comment));
                reveal(rowRef);
              }}
            />
          )}
          {TodoCommentPolicy.canCopyComment(comment) && (
            <MenuActionItem
              icon={CopyIcon}
              title={t('actions.copy')}
              testID="todo-comment-copy"
              onPress={copyContent}
            />
          )}
          {hasPrimaryActions && hasSecondaryActions && <Separator className="my-1" />}
          {TodoCommentPolicy.canDeleteComment(comment) && (
            <MenuActionItem
              icon={TrashIcon}
              title={t('actions.delete')}
              variant="danger"
              testID="todo-comment-delete"
              onPress={confirmDelete}
            />
          )}
          {TodoCommentPolicy.canReportComment(comment) && (
            <MenuActionItem
              icon={FlagIcon}
              title={t('actions.report')}
              testID="todo-comment-report"
              onPress={() =>
                push({
                  pathname: '/todo/[todoId]/comments/[commentId]/report',
                  params: { todoId, commentId: comment.id },
                })
              }
            />
          )}
          {author != null && TodoCommentPolicy.canBlockCommentAuthor(comment) && (
            <MenuActionItem
              icon={BlockIcon}
              title={t('actions.block', { name: authorName })}
              variant="danger"
              testID="todo-comment-block"
              onPress={() =>
                push({
                  pathname: '/users/[userId]/block',
                  params: { userId: author.id, name: authorName },
                })
              }
            />
          )}
        </Menu.Content>
      </Menu.Portal>
    </Menu>
  );
}
