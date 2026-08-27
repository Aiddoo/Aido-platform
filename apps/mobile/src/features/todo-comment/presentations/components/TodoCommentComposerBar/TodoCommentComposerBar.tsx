import { useTodoScreenParams } from '@src/features/todo/presentations/hooks/use-todo-screen-params';
import { useTodoDetailsQueryOptions } from '@src/features/todo/presentations/queries/use-todo-page-query-options';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/use-get-me-query-options';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { usePrefersReducedMotion } from '@src/shared/hooks/use-prefers-reduced-motion';
import { useTranslation } from '@src/shared/i18n';
import { Box, HStack, Text, TextButton } from '@src/shared/ui';
import { useInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query';
import { PressableFeedback, Skeleton } from 'heroui-native';
import { Suspense, useCallback, useEffect, useRef, type ComponentProps } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import {
  KeyboardGestureArea,
  KeyboardStickyView,
  useKeyboardState,
} from 'react-native-keyboard-controller';
import type { SharedValue } from 'react-native-reanimated';
import { withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type TodoCommentAuthor, TodoCommentPolicy } from '../../../models/todo-comment.model';
import { COMMENT_COMPOSER_INPUT_NATIVE_ID } from '../../constants/comment-composer.constants';
import { useCommentRouteState } from '../../hooks/use-comment-route-state';
import { useCancelTodoCommentScreenTransition } from '../../providers/todo-comment-screen-transition';
import { useTodoCommentConversationQueryOptions } from '../../queries/use-todo-comment-conversation-query-options';
import { toTodoCommentAuthor } from '../../view-models/todo-comment-composer.view-model';
import { TodoCommentAuthorAvatar } from '../TodoCommentAuthorAvatar';
import { TodoCommentComposerForm } from './TodoCommentComposerForm';

const STICKY_OFFSET = { closed: 0, opened: 0 };
const DEFAULT_BOTTOM_INSET = 16;

interface TodoCommentComposerBarProps {
  extraContentPadding: SharedValue<number>;
}

export function TodoCommentComposerBar({ extraContentPadding }: TodoCommentComposerBarProps) {
  const route = useCommentRouteState();
  const cancelTransition = useCancelTodoCommentScreenTransition();
  const insets = useSafeAreaInsets();
  const isKeyboardVisible = useKeyboardState((state) => state.isVisible);
  const prefersReducedMotion = usePrefersReducedMotion();
  const layoutBaselineRef = useRef({ identity: '', height: 0 });
  const wasKeyboardVisibleRef = useRef(isKeyboardVisible);
  const layoutIdentity = `${route.mode}:${route.anchorCommentId ?? 'none'}`;
  const bottomPadding = isKeyboardVisible ? 8 : (insets.bottom || DEFAULT_BOTTOM_INSET) + 4;

  const setExtraContentPadding = useCallback(
    (padding: number) => {
      extraContentPadding.value = prefersReducedMotion
        ? padding
        : withTiming(padding, { duration: ANIMATION.duration.fast });
    },
    [extraContentPadding, prefersReducedMotion],
  );

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const height = event.nativeEvent.layout.height;
      const hasNewLayout = layoutBaselineRef.current.identity !== layoutIdentity;

      if (hasNewLayout || !isKeyboardVisible) {
        layoutBaselineRef.current = { identity: layoutIdentity, height };
        setExtraContentPadding(0);
        return;
      }

      setExtraContentPadding(Math.max(height - layoutBaselineRef.current.height, 0));
    },
    [isKeyboardVisible, layoutIdentity, setExtraContentPadding],
  );

  useEffect(() => {
    if (wasKeyboardVisibleRef.current && !isKeyboardVisible) {
      cancelTransition();
    }
    wasKeyboardVisibleRef.current = isKeyboardVisible;

    if (!isKeyboardVisible) {
      setExtraContentPadding(0);
    }
  }, [cancelTransition, isKeyboardVisible, setExtraContentPadding]);

  useEffect(() => {
    setExtraContentPadding(0);
  }, [layoutIdentity, setExtraContentPadding]);

  useEffect(() => {
    return () => {
      extraContentPadding.value = 0;
    };
  }, [extraContentPadding]);

  return (
    <KeyboardStickyView offset={STICKY_OFFSET}>
      <KeyboardGestureArea textInputNativeID={COMMENT_COMPOSER_INPUT_NATIVE_ID}>
        <Box
          px={12}
          pt={8}
          style={{ paddingBottom: bottomPadding }}
          className="bg-background"
          onLayout={handleLayout}
        >
          <Suspense fallback={<TodoCommentComposerBar.Loading />}>
            <TodoCommentComposerContent />
          </Suspense>
        </Box>
      </KeyboardGestureArea>
    </KeyboardStickyView>
  );
}

TodoCommentComposerBar.Loading = function Loading() {
  return <Skeleton className="h-14 w-full rounded-3xl" />;
};
const TEXT_ACTION_TOUCH_TARGET = 'min-h-11 min-w-11';

function TodoCommentComposerContent() {
  const route = useCommentRouteState();

  if (route.mode === 'overview') {
    return <NewCommentComposerTrigger />;
  }

  if (route.mode === 'create') {
    return <ActiveNewCommentComposer />;
  }

  if (route.mode === 'thread') {
    return <SelectedCommentReplyTrigger />;
  }

  return <ActiveReplyOrEditComposer />;
}

interface TodoCommentComposerTriggerProps extends Omit<
  ComponentProps<typeof PressableFeedback>,
  'children' | 'accessibilityRole'
> {
  author: TodoCommentAuthor;
  placeholder: string;
}

function TodoCommentComposerTrigger({
  author,
  placeholder,
  ...pressableProps
}: TodoCommentComposerTriggerProps) {
  return (
    <PressableFeedback
      {...pressableProps}
      accessibilityRole="button"
      accessibilityLabel={pressableProps.accessibilityLabel ?? placeholder}
    >
      <HStack gap={10} align="center" className="min-h-14 rounded-3xl bg-gray-2 px-4">
        <TodoCommentAuthorAvatar author={author} size="sm" />
        <Text size="b3" shade={5} className="flex-1">
          {placeholder}
        </Text>
      </HStack>
    </PressableFeedback>
  );
}

function NewCommentComposerTrigger() {
  const { todoId } = useTodoScreenParams();
  const { data: detail } = useSuspenseQuery(useTodoDetailsQueryOptions(todoId));
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const { startCreate } = useCommentRouteState();
  const cancelTransition = useCancelTodoCommentScreenTransition();
  const { t } = useTranslation('todoComment');

  if (!detail.permissions.canComment) {
    return <CommentingUnavailableMessage />;
  }

  return (
    <TodoCommentComposerTrigger
      author={toTodoCommentAuthor(user, detail.owner.id)}
      placeholder={t('input.placeholder')}
      onPress={() => {
        cancelTransition();
        startCreate();
      }}
    />
  );
}

function SelectedCommentReplyTrigger() {
  const { todoId } = useTodoScreenParams();
  const route = useCommentRouteState();
  const cancelTransition = useCancelTodoCommentScreenTransition();
  const { data: detail } = useSuspenseQuery(useTodoDetailsQueryOptions(todoId));
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const commentId = route.mode === 'thread' ? route.anchorCommentId : undefined;
  const conversation = useInfiniteQuery(
    useTodoCommentConversationQueryOptions({
      todoId,
      sort: route.sort,
      focusCommentId: commentId,
    }),
  );
  const { t } = useTranslation('todoComment');

  if (!detail.permissions.canComment) {
    return <CommentingUnavailableMessage />;
  }

  if (commentId === undefined) {
    return null;
  }

  if (conversation.isPending) {
    return <TodoCommentComposerContent.Loading />;
  }

  if (conversation.isError && conversation.data === undefined) {
    throw conversation.error;
  }

  const target = conversation.data?.rows.find((row) => row.comment.id === commentId)?.comment;
  const canReply = target !== undefined && TodoCommentPolicy.canReply(target);

  return (
    <TodoCommentComposerTrigger
      author={toTodoCommentAuthor(user, detail.owner.id)}
      placeholder={canReply ? t('input.replyPlaceholder') : t('input.replyUnavailable')}
      isDisabled={!canReply}
      onPress={
        canReply
          ? () => {
              cancelTransition();
              route.startReply(target.id);
            }
          : undefined
      }
    />
  );
}

function ActiveNewCommentComposer() {
  const { todoId } = useTodoScreenParams();
  const { data: detail } = useSuspenseQuery(useTodoDetailsQueryOptions(todoId));
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const route = useCommentRouteState();
  const { t } = useTranslation('todoComment');

  if (!detail.permissions.canComment) {
    return (
      <UnavailableCommentComposerMessage
        message={t('input.commentingDisabled')}
        onRequestClose={route.closeComposer}
      />
    );
  }

  return (
    <TodoCommentComposerForm
      author={toTodoCommentAuthor(user, detail.owner.id)}
      session={{ mode: 'create' }}
    />
  );
}

function ActiveReplyOrEditComposer() {
  const { todoId } = useTodoScreenParams();
  const route = useCommentRouteState();
  const { data: detail } = useSuspenseQuery(useTodoDetailsQueryOptions(todoId));
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const { t } = useTranslation('todoComment');
  const isActive = route.mode === 'reply' || route.mode === 'edit';
  const commentId = isActive ? route.anchorCommentId : undefined;
  const conversation = useInfiniteQuery(
    useTodoCommentConversationQueryOptions({
      todoId,
      sort: route.sort,
      focusCommentId: commentId,
    }),
  );

  if ((route.mode !== 'reply' && route.mode !== 'edit') || commentId === undefined) {
    return null;
  }

  if (conversation.isPending) {
    return <TodoCommentComposerContent.Loading />;
  }

  if (conversation.isError && conversation.data === undefined) {
    throw conversation.error;
  }

  const target = conversation.data?.rows.find((row) => row.comment.id === commentId)?.comment;
  if (target === undefined) {
    return (
      <UnavailableCommentComposerMessage
        message={route.mode === 'edit' ? t('input.editUnavailable') : t('input.replyUnavailable')}
        onRequestClose={route.closeComposer}
      />
    );
  }

  if (route.mode === 'reply' && !detail.permissions.canComment) {
    return (
      <UnavailableCommentComposerMessage
        message={t('input.commentingDisabled')}
        onRequestClose={route.closeComposer}
      />
    );
  }

  if (route.mode === 'reply' && !TodoCommentPolicy.canReply(target)) {
    return (
      <UnavailableCommentComposerMessage
        message={t('input.replyUnavailable')}
        onRequestClose={route.closeComposer}
      />
    );
  }

  if (route.mode === 'edit' && !TodoCommentPolicy.canEdit(target)) {
    return (
      <UnavailableCommentComposerMessage
        message={t('input.editUnavailable')}
        onRequestClose={route.closeComposer}
      />
    );
  }

  return (
    <TodoCommentComposerForm
      key={`${route.mode}:${commentId}`}
      author={toTodoCommentAuthor(user, detail.owner.id)}
      session={{ mode: route.mode, target }}
    />
  );
}

function CommentingUnavailableMessage() {
  const { t } = useTranslation('todoComment');

  return (
    <Box py={8} className="items-center">
      <Text size="b4" shade={6}>
        {t('input.commentingDisabled')}
      </Text>
    </Box>
  );
}

function UnavailableCommentComposerMessage({
  message,
  onRequestClose,
}: {
  message: string;
  onRequestClose: () => void;
}) {
  const { t } = useTranslation('todoComment');
  const cancelTransition = useCancelTodoCommentScreenTransition();

  return (
    <HStack align="center" justify="between" gap={8} className="min-h-11">
      <Text size="b4" shade={6} className="flex-1">
        {message}
      </Text>
      <TextButton
        size="small"
        className={TEXT_ACTION_TOUCH_TARGET}
        onPress={() => {
          cancelTransition();
          onRequestClose();
        }}
        accessibilityLabel={t('actions.cancel')}
      >
        {t('actions.cancel')}
      </TextButton>
    </HStack>
  );
}

TodoCommentComposerContent.Loading = function Loading() {
  return <Skeleton className="h-14 w-full rounded-3xl" />;
};
