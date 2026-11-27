import { useHaptics } from '@src/bootstrap/providers/di-context';
import { useMyPendingCoachmark } from '@src/features/device/coachmark/hooks/use-my-pending-coachmark';
import { useTrack } from '@src/shared/analytics';
import { ANIMATION } from '@src/shared/constants/animation';
import { formatRelativeTimeLabel } from '@src/shared/date/format/date-labels';
import { useCopyToClipboard } from '@src/shared/hooks/use-copy-to-clipboard';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useIsReduceMotionEnabled } from '@src/shared/hooks/use-is-reduce-motion-enabled';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
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
  VStack,
  MenuContent,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useMutation } from '@tanstack/react-query';
import { compact, noop } from 'es-toolkit';
import { useRouter } from 'expo-router';
import { Menu, PressableFeedback, Separator, Skeleton, Spinner } from 'heroui-native';
import {
  type ComponentProps,
  type ComponentRef,
  type PropsWithChildren,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';
import { StyleSheet, type View } from 'react-native';
import {
  GestureDetector,
  useExclusiveGestures,
  useLongPressGesture,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { match } from 'ts-pattern';

import { toEditFormValues, toReplyFormValues } from '../apis/todo-comment.mapper';
import { TODO_COMMENT_LOG_EVENT } from '../constants/todo-comment-log-events';
import { TODO_COMMENT_HIGHLIGHT_DURATION_MS } from '../constants/todo-comment.constants';
import { type TodoComment, TodoCommentPolicy } from '../domains/todo-comment.model';
import { useConfirmTodoCommentDelete } from '../hooks/use-confirm-todo-comment-delete';
import { useTodoCommentForm } from '../hooks/use-todo-comment-form';
import {
  useIsTodoCommentHighlighted,
  useTodoCommentReveal,
} from '../hooks/use-todo-comment-reveal';
import { useSetTodoCommentLikeMutationOptions } from '../queries/todo-comment.mutations';
import {
  TODO_COMMENT_AUTHOR_AVATAR_SIZE,
  TodoCommentAuthorAvatar,
} from './todo-comment-author-avatar';
import {
  playTodoCommentHeartBurst,
  popTodoCommentLikeButton,
  TodoCommentHeartBurst,
  type TodoCommentHeartBurstValues,
  useTodoCommentHeartBurstValues,
} from './todo-comment-heart-burst';

const MENU_TRIGGER_ICON_SIZE = 18;

const MENU_WIDTH = 200;
const MORE_HIT_SLOP = 12;

const DOUBLE_TAP_MAX_DELAY_MS = 300;
const LONG_PRESS_MIN_DURATION_MS = 450;

const ROW_PADDING_X = 16;
const ROW_PADDING_TOP = 14;
const ROW_PADDING_BOTTOM = 6;
const AVATAR_GAP = 12;
const RAIL_WIDTH = 2;
const RAIL_AVATAR_GAP = 4;
const CURVE_RADIUS = 12;
const CURVE_AVATAR_GAP = 6;
const MORE_ROW_HEIGHT = 44;
const HIGHLIGHT_FADE_IN_MS = 120;
const HIGHLIGHT_FADE_OUT_MS = ANIMATION.durationMs.emphasis;
/** 알림으로 연 묶음으로 목록이 먼저 옮겨 간 뒤 강조한 행을 작성 바 위로 올린다 */
const HIGHLIGHT_REVEAL_DELAY_MS = 450;

/** 연결선은 글자 크기에 따라 바뀌지 않는 아바타 열에만 맞추고, start/end로 두어 RTL에서도 같은 쪽에 그린다 */
const COMMENT_AVATAR = TODO_COMMENT_AUTHOR_AVATAR_SIZE.md;
const REPLY_AVATAR = TODO_COMMENT_AUTHOR_AVATAR_SIZE.sm;
const RAIL_START = ROW_PADDING_X + COMMENT_AVATAR / 2 - RAIL_WIDTH / 2;
const TODO_COMMENT_REPLY_INSET = ROW_PADDING_X + COMMENT_AVATAR + AVATAR_GAP;
const CURVE_WIDTH = TODO_COMMENT_REPLY_INSET - CURVE_AVATAR_GAP - RAIL_START;

const styles = StyleSheet.create({
  row: { position: 'relative', paddingEnd: ROW_PADDING_X },
  contentRow: { paddingTop: ROW_PADDING_TOP, paddingBottom: ROW_PADDING_BOTTOM },
  moreRow: { minHeight: MORE_ROW_HEIGHT, justifyContent: 'center' },
  headRail: {
    position: 'absolute',
    start: RAIL_START,
    top: ROW_PADDING_TOP + COMMENT_AVATAR + RAIL_AVATAR_GAP,
    bottom: 0,
    width: RAIL_WIDTH,
    borderRadius: RAIL_WIDTH / 2,
  },
  throughRail: {
    position: 'absolute',
    start: RAIL_START,
    top: 0,
    bottom: 0,
    width: RAIL_WIDTH,
  },
  curve: {
    position: 'absolute',
    start: RAIL_START,
    top: 0,
    width: CURVE_WIDTH,
    borderStartWidth: RAIL_WIDTH,
    borderBottomWidth: RAIL_WIDTH,
    borderBottomStartRadius: CURVE_RADIUS,
  },
});

interface TodoCommentItemProps {
  comment: TodoComment;
  /** 댓글: 아래에 답글이 이어져 아바타 밑으로 세로선을 내린다 */
  hasReplies?: boolean;
  /** 답글: 묶음의 마지막 줄이라 세로선을 닫는다 */
  isLast?: boolean;
}

/** 깊이는 댓글·답글 두 단이라 글이 답글인지로 들여쓰기와 선을 정한다. 아바타 열은 글자 크기와 상관없이 고정이다 */
export function TodoCommentItem({
  comment,
  hasReplies = false,
  isLast = false,
}: TodoCommentItemProps) {
  const rowRef = useRef<ComponentRef<typeof View>>(null);
  const displayState = TodoCommentPolicy.getDisplayState(comment);
  const isReply = TodoCommentPolicy.isReply(comment);

  return (
    <TodoCommentRailRow
      kind={isReply ? { type: 'reply', isLast } : { type: 'comment', hasReplies }}
      commentId={comment.id}
    >
      <Box ref={rowRef} collapsable={false}>
        <HStack gap={12} align="start" className="min-w-0">
          <TodoCommentAuthorAvatar
            author={comment.author}
            size={isReply ? 'sm' : 'md'}
            className={cn(displayState !== 'active' && 'opacity-40')}
          />
          {/* oxlint-disable-next-line aido/spacing-scale -- 작성자 줄과 본문 사이는 글줄 간격이라 규격 단계 사이 3px을 쓴다 */}
          <VStack gap={3} flex={1} className="min-w-0">
            {match(displayState)
              .with('active', () => <ActiveComment comment={comment} rowRef={rowRef} />)
              .with('deleted', 'blockedAuthor', (state) => <Placeholder state={state} />)
              .exhaustive()}
          </VStack>
        </HStack>
      </Box>
    </TodoCommentRailRow>
  );
}

interface TodoCommentItemMoreProps extends Omit<
  ComponentProps<typeof PressableFeedback>,
  | 'children'
  | 'className'
  | 'isDisabled'
  | 'accessibilityRole'
  | 'accessibilityLabel'
  | 'accessibilityState'
> {
  label: string;
  /** 답글 줄이면 들여쓰고 연결선을 잇는다. 댓글 줄이면 목록 가운데에 놓는다 */
  isReply?: boolean;
  isLoading?: boolean;
  /** 아래로 답글이 이어지면 세로선을 끊지 않는다 */
  isConnectedBelow?: boolean;
}

TodoCommentItem.More = function More({
  label,
  isReply = false,
  isLoading = false,
  isConnectedBelow = false,
  ...props
}: TodoCommentItemMoreProps) {
  // 댓글 줄은 받는 중을 알리고 글자로 읽힌다. 답글 줄은 한 줄로 잘려도 다 읽히게 이름을 따로 준다
  const accessibility = isReply
    ? { accessibilityLabel: label }
    : { accessibilityState: { busy: isLoading } };
  const button = (
    <PressableFeedback
      {...props}
      {...accessibility}
      className={cn(
        'min-h-11',
        isReply ? 'justify-center self-start pe-3' : 'flex-row items-center justify-center gap-2',
      )}
      isDisabled={isLoading}
      accessibilityRole="button"
    >
      {isLoading && <Spinner size="sm" />}
      {/* 답글 줄은 들여쓴 폭에서 한 줄로 자르고, 목록 가운데의 댓글 줄은 줄바꿈을 그대로 둔다 */}
      <Text size="e1" shade={7} weight="medium" numberOfLines={isReply ? 1 : undefined}>
        {label}
      </Text>
    </PressableFeedback>
  );

  if (!isReply) {
    return button;
  }

  return (
    <TodoCommentRailRow
      kind={isConnectedBelow ? { type: 'reply', isLast: false } : { type: 'more' }}
    >
      {button}
    </TodoCommentRailRow>
  );
};

/** 받는 동안 같은 높이를 잡는 한 줄. 답글은 묶음의 마지막 줄로 선을 닫는다 */
TodoCommentItem.Loading = function Loading({ isReply = false }: { isReply?: boolean }) {
  return (
    <TodoCommentRailRow
      kind={isReply ? { type: 'reply', isLast: true } : { type: 'comment', hasReplies: false }}
    >
      <HStack gap={12} align="start" className="min-w-0">
        <Skeleton className={cn('rounded-full', isReply ? 'size-7' : 'size-9')} />
        <VStack gap={6} flex={1} className="min-w-0 py-1">
          <TextSkeleton size="b4" className="w-28" />
          <TextSkeleton size="b3" className="w-4/5" />
          <TextSkeleton size="e1" className="w-16" />
        </VStack>
      </HStack>
    </TodoCommentRailRow>
  );
};

type TodoCommentRailRowKind =
  | { type: 'comment'; hasReplies: boolean }
  | { type: 'reply'; isLast: boolean }
  | { type: 'more' };

interface TodoCommentRailRowProps extends PropsWithChildren {
  kind: TodoCommentRailRowKind;
  /** 이 줄이 그리는 글. 알림으로 연 글이면 잠깐 강조한다. 더 보기·받는 중 줄은 없다 */
  commentId?: string;
}

/** 강조는 이 줄만 구독해, 켜지고 꺼질 때 안의 본문·메뉴는 다시 그려지지 않는다 */
function TodoCommentRailRow({ kind, commentId, children }: TodoCommentRailRowProps) {
  const paddingStart = kind.type === 'comment' ? ROW_PADDING_X : TODO_COMMENT_REPLY_INSET;
  const rowRef = useRef<ComponentRef<typeof View>>(null);
  const { showAboveComposer } = useTodoCommentReveal();
  const isHighlighted = useIsTodoCommentHighlighted(commentId ?? null);

  useEffect(() => {
    if (!isHighlighted) {
      return;
    }
    const timer = setTimeout(() => showAboveComposer(rowRef), HIGHLIGHT_REVEAL_DELAY_MS);

    return () => clearTimeout(timer);
  }, [isHighlighted, showAboveComposer]);

  return (
    <Box
      ref={rowRef}
      collapsable={false}
      style={[
        styles.row,
        { paddingStart },
        kind.type === 'more' ? styles.moreRow : styles.contentRow,
      ]}
    >
      {isHighlighted && <RowHighlight />}
      <Rails kind={kind} />
      {children}
    </Box>
  );
}

function Rails({ kind }: { kind: TodoCommentRailRowKind }) {
  return match(kind)
    .with({ type: 'comment', hasReplies: false }, () => null)
    .with({ type: 'comment', hasReplies: true }, () => (
      <Box pointerEvents="none" style={styles.headRail} className="bg-gray-4" />
    ))
    .with({ type: 'reply' }, ({ isLast }) => (
      <>
        {!isLast && <Box pointerEvents="none" style={styles.throughRail} className="bg-gray-4" />}
        <Box
          pointerEvents="none"
          style={[styles.curve, { height: ROW_PADDING_TOP + REPLY_AVATAR / 2 }]}
          className="border-gray-4"
        />
      </>
    ))
    .with({ type: 'more' }, () => (
      <Box
        pointerEvents="none"
        style={[styles.curve, { height: MORE_ROW_HEIGHT / 2 }]}
        className="border-gray-4"
      />
    ))
    .exhaustive();
}

function RowHighlight() {
  const opacity = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  useEffect(() => {
    opacity.set(
      withSequence(
        withTiming(1, { duration: HIGHLIGHT_FADE_IN_MS }),
        withDelay(
          TODO_COMMENT_HIGHLIGHT_DURATION_MS - HIGHLIGHT_FADE_IN_MS - HIGHLIGHT_FADE_OUT_MS,
          withTiming(0, { duration: HIGHLIGHT_FADE_OUT_MS }),
        ),
      ),
    );
  }, [opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, style]}
      testID="todo-comment-highlight"
    >
      <Box flex={1} className="bg-main/15" />
    </Animated.View>
  );
}

interface ActiveCommentProps {
  comment: TodoComment;
  rowRef: RefObject<ComponentRef<typeof View> | null>;
}

/** 지우지도 차단하지도 않은 글의 작성자 줄·본문·하트·답글 달기. 본문 두 번 탭과 하트 버튼이 하트 요청 관찰자 하나를 함께 쓴다 */
function ActiveComment({ comment, rowRef }: ActiveCommentProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const likeButtonScale = useSharedValue(1);
  const actions = useCommentActions({ comment, rowRef });
  const { mutate: setLike } = useMutation(
    useSetTodoCommentLikeMutationOptions({ todoId: comment.todoId, commentId: comment.id }),
  );

  return (
    <>
      <AuthorLine
        comment={comment}
        menu={
          <ActionMenu
            comment={comment}
            actions={actions}
            isOpen={isMenuOpen}
            onOpenChange={setIsMenuOpen}
          />
        }
      />
      <CommentText
        comment={comment}
        actions={actions}
        likeButtonScale={likeButtonScale}
        onLike={() => setLike({ isLiked: true, via: 'double_tap' })}
        onLongPress={() => setIsMenuOpen(true)}
      />
      <HStack align="center" style={{ marginStart: -ICON_COUNT_BUTTON_INK_INSET }}>
        <LikeButton
          comment={comment}
          scale={likeButtonScale}
          onLikeChange={(isLiked) => setLike({ isLiked, via: 'button' })}
        />
        <ReplyButton comment={comment} rowRef={rowRef} />
      </HStack>
    </>
  );
}

/** 모자라면 줄바꿈에 맡기고 폭을 재서 나누지 않아 첫 화면 뒤에 줄 수가 바뀌며 밀리지 않는다 */
function AuthorLine({ comment, menu }: { comment: TodoComment; menu: ReactNode }) {
  const { t } = useTranslation('todoComment');
  const now = useMinuteNow();
  const dateFormatContext = useDateFormatContext();
  const timeLabel = compact([
    formatRelativeTimeLabel(comment.createdAt, now, dateFormatContext),
    comment.isEdited ? t('list.edited') : null,
  ]).join(' · ');
  const userTag = comment.author?.userTag;
  const name = comment.author?.name ?? t('list.unknownUser');

  return (
    <HStack gap={4} align="start" className="min-w-0">
      <HStack wrap="wrap" gap={4} align="center" className="min-w-0 flex-1 gap-y-px">
        <Text
          size="b4"
          weight="semibold"
          numberOfLines={1}
          ellipsizeMode="tail"
          className="max-w-full"
        >
          {name}
        </Text>
        {userTag != null && <Meta text={`#${userTag}`} isShrinkable />}
        {comment.author?.isTodoOwner === true && (
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
      numberOfLines={1}
      ellipsizeMode="tail"
      className={cn(isShrinkable ? 'min-w-0 shrink' : 'shrink-0 tabular-nums')}
    >
      {text}
    </Text>
  );
}

interface CommentTextProps {
  comment: TodoComment;
  actions: CommentActions;
  likeButtonScale: SharedValue<number>;
  onLike: () => void;
  onLongPress: () => void;
}

function CommentText({ comment, actions, likeButtonScale, onLike, onLongPress }: CommentTextProps) {
  const { t } = useTranslation('todoComment');
  const burst = useTodoCommentHeartBurstValues();
  const { trackEvent } = useTrack();
  const [isHintPending, completeHint] = useMyPendingCoachmark('comment-double-tap');
  const mention = comment.replyTo?.authorName;
  const gesture = useCommentBodyGesture({
    burst,
    likeButtonScale,
    canLike: TodoCommentPolicy.canLikeComment(comment),
    onDoubleTap: () => {
      if (isHintPending) {
        completeHint();
        trackEvent('todo_comment_hint_dismissed', { kind: 'double_tap', reason: 'used' });
      }
      // 이미 좋아요면 하트만 다시 보이고 요청은 보내지 않는다
      if (!comment.viewer.isLiked) {
        onLike();
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
      <Box
        collapsable={false}
        accessible
        accessibilityHint={t('actions.doubleTapToLike')}
        // 길게 누르기 메뉴의 동작을 스크린리더는 동작 메뉴에서 같은 이름으로 고른다
        accessibilityActions={compact([
          actions.edit != null && { name: 'edit', label: actions.edit.label },
          actions.copy != null && { name: 'copy', label: actions.copy.label },
          actions.remove != null && { name: 'delete', label: actions.remove.label },
          actions.report != null && { name: 'report', label: actions.report.label },
          actions.block != null && { name: 'block', label: actions.block.label },
        ])}
        onAccessibilityAction={(event) => {
          match(event.nativeEvent.actionName)
            .with('edit', () => actions.edit?.run())
            .with('copy', () => actions.copy?.run())
            .with('delete', () => actions.remove?.run())
            .with('report', () => actions.report?.run())
            .with('block', () => actions.block?.run())
            .otherwise(noop);
        }}
        testID={`todo-comment-body-${comment.id}`}
      >
        <Text size="b3" shade={9}>
          {mention != null && <Text size="b3" tone="brand">{`@${mention} `}</Text>}
          {comment.content}
        </Text>
        <TodoCommentHeartBurst burst={burst} />
      </Box>
    </GestureDetector>
  );
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

interface LikeButtonProps {
  comment: TodoComment;
  scale: SharedValue<number>;
  onLikeChange: (isLiked: boolean) => void;
}

function LikeButton({ comment, scale, onLikeChange }: LikeButtonProps) {
  const { t } = useTranslation('todoComment');
  const isReducedMotion = useIsReduceMotionEnabled();
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
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
        onLikeChange(!isLiked);
      }}
    />
  );
}

function ReplyButton({ comment, rowRef }: ActiveCommentProps) {
  const { t } = useTranslation('todoComment');
  const { trackEvent } = useTrack();
  const { reset } = useTodoCommentForm();
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
        reset(toReplyFormValues(comment));
        trackEvent('todo_comment_reply_started', {
          todo_id: comment.todoId,
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
  actions: CommentActions;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

/** ⋯와 길게 누르기가 같은 메뉴를 연다. 내 글은 수정·복사·삭제, 남의 글은 복사·신고·차단이다 */
function ActionMenu({ comment, actions, isOpen, onOpenChange }: ActionMenuProps) {
  const { t } = useTranslation('todoComment');
  const fontScaledSize = useFontScaledSize();
  const hasPrimaryActions = actions.edit != null || actions.copy != null;
  const hasSecondaryActions =
    actions.remove != null || actions.report != null || actions.block != null;

  if (!hasPrimaryActions && !hasSecondaryActions) {
    return null;
  }

  return (
    <Menu isOpen={isOpen} onOpenChange={onOpenChange}>
      <Menu.Trigger asChild>
        <PressableFeedback
          hitSlop={MORE_HIT_SLOP}
          className="min-h-6 min-w-8 items-center justify-center"
          testID={`todo-comment-more-${comment.id}`}
          accessibilityRole="button"
          accessibilityLabel={t('actions.more')}
          accessibilityState={{ expanded: isOpen }}
        >
          <MoreIcon
            width={fontScaledSize(MENU_TRIGGER_ICON_SIZE)}
            height={fontScaledSize(MENU_TRIGGER_ICON_SIZE)}
            colorClassName="text-gray-6"
          />
        </PressableFeedback>
      </Menu.Trigger>
      <MenuContent width={MENU_WIDTH}>
        {actions.edit != null && (
          <MenuActionItem
            Icon={EditIcon}
            title={actions.edit.label}
            testID="todo-comment-edit"
            onPress={actions.edit.run}
          />
        )}
        {actions.copy != null && (
          <MenuActionItem
            Icon={CopyIcon}
            title={actions.copy.label}
            testID="todo-comment-copy"
            onPress={actions.copy.run}
          />
        )}
        {hasPrimaryActions && hasSecondaryActions && <Separator className="my-1" />}
        {actions.remove != null && (
          <MenuActionItem
            Icon={TrashIcon}
            title={actions.remove.label}
            variant="danger"
            testID="todo-comment-delete"
            onPress={actions.remove.run}
          />
        )}
        {actions.report != null && (
          <MenuActionItem
            Icon={FlagIcon}
            title={actions.report.label}
            testID="todo-comment-report"
            onPress={actions.report.run}
          />
        )}
        {actions.block != null && (
          <MenuActionItem
            Icon={BlockIcon}
            title={actions.block.label}
            variant="danger"
            testID="todo-comment-block"
            onPress={actions.block.run}
          />
        )}
      </MenuContent>
    </Menu>
  );
}

interface CommentAction {
  label: string;
  run: () => void;
}

/** 할 수 없는 동작은 null이다 */
interface CommentActions {
  edit: CommentAction | null;
  copy: CommentAction | null;
  remove: CommentAction | null;
  report: CommentAction | null;
  block: CommentAction | null;
}

interface CommentBodyGestureOptions {
  burst: TodoCommentHeartBurstValues;
  likeButtonScale: SharedValue<number>;
  canLike: boolean;
  onDoubleTap: () => void;
  onLongPress: () => void;
}

/** 애니메이션은 shared value로 UI 스레드에서만 돌고, 좋아요 요청과 진동만 JS로 넘긴다 */
function useCommentBodyGesture({
  burst,
  likeButtonScale,
  canLike,
  onDoubleTap,
  onLongPress,
}: CommentBodyGestureOptions) {
  const haptics = useHaptics();
  const isReducedMotion = useIsReduceMotionEnabled();
  const lightImpact = () => haptics.impact('light');

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    maxDelay: DOUBLE_TAP_MAX_DELAY_MS,
    enabled: canLike,
    onActivate: (event) => {
      'worklet';
      playTodoCommentHeartBurst(burst, { x: event.x, y: event.y, isReducedMotion });
      if (!isReducedMotion) {
        popTodoCommentLikeButton(likeButtonScale);
      }
      scheduleOnRN(lightImpact);
      scheduleOnRN(onDoubleTap);
    },
  });
  const longPress = useLongPressGesture({
    minDuration: LONG_PRESS_MIN_DURATION_MS,
    onActivate: () => {
      'worklet';
      scheduleOnRN(onLongPress);
    },
  });

  return useExclusiveGestures(doubleTap, longPress);
}

/** ⋯ 메뉴와 본문의 스크린리더 동작이 같은 이름과 같은 동작을 쓴다 */
function useCommentActions({ comment, rowRef }: ActiveCommentProps): CommentActions {
  const { t } = useTranslation(['todoComment', 'moderation', 'common']);
  const router = useRouter();
  const push = useSingleTap(router.push);
  const copy = useCopyToClipboard();
  const confirmDelete = useConfirmTodoCommentDelete();
  const { reset } = useTodoCommentForm();
  const { reveal } = useTodoCommentReveal();
  const author = comment.author;
  const authorName = author?.name ?? t('moderation:fallbackName');
  const copyableContent = TodoCommentPolicy.findCopyableContent(comment);

  return {
    edit: TodoCommentPolicy.canEditComment(comment)
      ? {
          label: t('common:actions.edit'),
          run: () => {
            reset(toEditFormValues(comment));
            reveal(rowRef);
          },
        }
      : null,
    copy:
      copyableContent == null
        ? null
        : {
            label: t('actions.copy'),
            run: () =>
              copy(copyableContent, {
                successMessage: t('toasts.copied'),
                failureMessage: t('toasts.copyFailed'),
                failureLogEvent: TODO_COMMENT_LOG_EVENT.COPY_FAILED,
              }),
          },
    remove: TodoCommentPolicy.canDeleteComment(comment)
      ? { label: t('common:actions.delete'), run: () => confirmDelete(comment) }
      : null,
    report: TodoCommentPolicy.canReportComment(comment)
      ? {
          label: t('actions.report'),
          run: () =>
            push({
              pathname: '/todo/[todoId]/comments/[commentId]/report',
              params: { todoId: comment.todoId, commentId: comment.id },
            }),
        }
      : null,
    block:
      author != null && TodoCommentPolicy.canBlockCommentAuthor(comment)
        ? {
            label: t('actions.block', { name: authorName }),
            run: () =>
              push({
                pathname: '/users/[userId]/block',
                params: { userId: author.id, name: authorName },
              }),
          }
        : null,
  };
}
