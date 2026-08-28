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
import { KeyboardStickyView, useKeyboardState } from 'react-native-keyboard-controller';
import type { SharedValue } from 'react-native-reanimated';
import { withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type TodoCommentAuthor, TodoCommentPolicy } from '../../../models/todo-comment.model';
import { useTodoCommentRoute } from '../../hooks/use-todo-comment-route';
import { useCancelTodoCommentScreenTransition } from '../../providers/todo-comment-screen-transition-provider';
import { useTodoCommentConversationQueryOptions } from '../../queries/use-todo-comment-conversation-query-options';
import { toTodoCommentAuthor } from '../../view-models/todo-comment-form.view-model';
import { TodoCommentAuthorAvatar } from '../TodoCommentAuthorAvatar';
import { TodoCommentForm } from './TodoCommentForm';

const STICKY_OFFSET = { closed: 0, opened: 0 };
const DEFAULT_BOTTOM_INSET = 16;

interface TodoCommentInputBarProps {
  extraContentPadding: SharedValue<number>;
}

export function TodoCommentInputBar({ extraContentPadding }: TodoCommentInputBarProps) {
  const [commentRoute] = useTodoCommentRoute();
  const cancelTransition = useCancelTodoCommentScreenTransition();
  const insets = useSafeAreaInsets();
  const isKeyboardVisible = useKeyboardState((state) => state.isVisible);
  const prefersReducedMotion = usePrefersReducedMotion();
  const layoutBaselineRef = useRef({ identity: '', contentHeight: 0 });
  const wasKeyboardVisibleRef = useRef(isKeyboardVisible);
  const layoutIdentity =
    commentRoute.view === 'overview'
      ? `overview:${commentRoute.form?.type ?? 'reading'}`
      : `conversation:${commentRoute.commentId}:${commentRoute.form?.type ?? 'reading'}`;
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
      const contentHeight = event.nativeEvent.layout.height - bottomPadding;
      const hasNewLayout = layoutBaselineRef.current.identity !== layoutIdentity;

      if (hasNewLayout || !isKeyboardVisible) {
        layoutBaselineRef.current = { identity: layoutIdentity, contentHeight };
        setExtraContentPadding(0);
        return;
      }

      setExtraContentPadding(Math.max(contentHeight - layoutBaselineRef.current.contentHeight, 0));
    },
    [bottomPadding, isKeyboardVisible, layoutIdentity, setExtraContentPadding],
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
      <Box
        px={12}
        pt={8}
        style={{ paddingBottom: bottomPadding }}
        className="bg-background"
        onLayout={handleLayout}
      >
        <Suspense fallback={<TodoCommentInputBar.Loading />}>
          <CommentInputByRoute />
        </Suspense>
      </Box>
    </KeyboardStickyView>
  );
}

TodoCommentInputBar.Loading = function Loading() {
  return <Skeleton className="h-14 w-full rounded-3xl" />;
};
const TEXT_ACTION_TOUCH_TARGET = 'min-h-11 min-w-11';

function CommentInputByRoute() {
  const [commentRoute] = useTodoCommentRoute();

  if (commentRoute.view === 'overview') {
    return commentRoute.form === null ? <NewCommentButton /> : <NewCommentForm />;
  }

  return commentRoute.form === null ? <ReplyToSelectedCommentButton /> : <SelectedCommentForm />;
}

interface CommentInputTriggerProps extends Omit<
  ComponentProps<typeof PressableFeedback>,
  'children' | 'accessibilityRole'
> {
  author: TodoCommentAuthor;
  placeholder: string;
}

function CommentInputTrigger({ author, placeholder, ...pressableProps }: CommentInputTriggerProps) {
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

function NewCommentButton() {
  const { todoId } = useTodoScreenParams();
  const { data: detail } = useSuspenseQuery(useTodoDetailsQueryOptions(todoId));
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const [, updateCommentRoute] = useTodoCommentRoute();
  const cancelTransition = useCancelTodoCommentScreenTransition();
  const { t } = useTranslation('todoComment');

  if (!detail.permissions.canComment) {
    return <CommentingUnavailableMessage />;
  }

  return (
    <CommentInputTrigger
      author={toTodoCommentAuthor(user, detail.owner.id)}
      placeholder={t('input.placeholder')}
      onPress={() => {
        cancelTransition();
        updateCommentRoute.startNewComment();
      }}
    />
  );
}

function ReplyToSelectedCommentButton() {
  const { todoId } = useTodoScreenParams();
  const [commentRoute, updateCommentRoute] = useTodoCommentRoute();
  const cancelTransition = useCancelTodoCommentScreenTransition();
  const { data: detail } = useSuspenseQuery(useTodoDetailsQueryOptions(todoId));
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const commentId =
    commentRoute.view === 'conversation' && commentRoute.form === null
      ? commentRoute.commentId
      : undefined;
  const conversation = useInfiniteQuery(
    useTodoCommentConversationQueryOptions({
      todoId,
      sort: commentRoute.sort,
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
    return <TodoCommentInputBar.Loading />;
  }

  if (conversation.isError && conversation.data === undefined) {
    throw conversation.error;
  }

  const target = conversation.data?.rows.find((row) => row.comment.id === commentId)?.comment;
  const canReply = target !== undefined && TodoCommentPolicy.canReply(target);

  return (
    <CommentInputTrigger
      author={toTodoCommentAuthor(user, detail.owner.id)}
      placeholder={canReply ? t('input.replyPlaceholder') : t('input.replyUnavailable')}
      isDisabled={!canReply}
      onPress={
        canReply
          ? () => {
              cancelTransition();
              updateCommentRoute.startReply(target.id);
            }
          : undefined
      }
    />
  );
}

function NewCommentForm() {
  const { todoId } = useTodoScreenParams();
  const { data: detail } = useSuspenseQuery(useTodoDetailsQueryOptions(todoId));
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const [, updateCommentRoute] = useTodoCommentRoute();
  const { t } = useTranslation('todoComment');

  if (!detail.permissions.canComment) {
    return (
      <UnavailableCommentFormMessage
        message={t('input.commentingDisabled')}
        onRequestClose={updateCommentRoute.cancelForm}
      />
    );
  }

  return (
    <TodoCommentForm
      author={toTodoCommentAuthor(user, detail.owner.id)}
      session={{ type: 'new' }}
    />
  );
}

function SelectedCommentForm() {
  const { todoId } = useTodoScreenParams();
  const [commentRoute, updateCommentRoute] = useTodoCommentRoute();
  const { data: detail } = useSuspenseQuery(useTodoDetailsQueryOptions(todoId));
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const { t } = useTranslation('todoComment');
  const activeForm = commentRoute.view === 'conversation' ? commentRoute.form : null;
  const commentId =
    commentRoute.view === 'conversation' && activeForm !== null
      ? commentRoute.commentId
      : undefined;
  const conversation = useInfiniteQuery(
    useTodoCommentConversationQueryOptions({
      todoId,
      sort: commentRoute.sort,
      focusCommentId: commentId,
    }),
  );

  if (activeForm === null || commentId === undefined) {
    return null;
  }

  if (conversation.isPending) {
    return <TodoCommentInputBar.Loading />;
  }

  if (conversation.isError && conversation.data === undefined) {
    throw conversation.error;
  }

  const target = conversation.data?.rows.find((row) => row.comment.id === commentId)?.comment;
  if (target === undefined) {
    return (
      <UnavailableCommentFormMessage
        message={
          activeForm.type === 'edit' ? t('input.editUnavailable') : t('input.replyUnavailable')
        }
        onRequestClose={updateCommentRoute.cancelForm}
      />
    );
  }

  if (activeForm.type === 'reply' && !detail.permissions.canComment) {
    return (
      <UnavailableCommentFormMessage
        message={t('input.commentingDisabled')}
        onRequestClose={updateCommentRoute.cancelForm}
      />
    );
  }

  if (activeForm.type === 'reply' && !TodoCommentPolicy.canReply(target)) {
    return (
      <UnavailableCommentFormMessage
        message={t('input.replyUnavailable')}
        onRequestClose={updateCommentRoute.cancelForm}
      />
    );
  }

  if (activeForm.type === 'edit' && !TodoCommentPolicy.canEdit(target)) {
    return (
      <UnavailableCommentFormMessage
        message={t('input.editUnavailable')}
        onRequestClose={updateCommentRoute.cancelForm}
      />
    );
  }

  return (
    <TodoCommentForm
      key={activeForm.type}
      author={toTodoCommentAuthor(user, detail.owner.id)}
      session={{ type: activeForm.type, target }}
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

function UnavailableCommentFormMessage({
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
