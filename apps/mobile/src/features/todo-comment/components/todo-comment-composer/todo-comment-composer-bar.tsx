import { useTodoScreenParams } from '@src/features/todo/hooks/use-todo-screen-params';
import { useGetTodoDetailsQueryOptions } from '@src/features/todo/queries/get-todo-details-query-options';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { useTranslation } from '@src/shared/i18n';
import { useKeyboardBottomGap } from '@src/shared/providers/keyboard-bottom-gap-provider';
import { Box, Text } from '@src/shared/ui';
import { useSuspenseQueries } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { Suspense, useCallback, useEffect, useRef } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { KeyboardStickyView, useKeyboardHandler } from 'react-native-keyboard-controller';
import Animated, {
  interpolate,
  ReduceMotion,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTodoCommentReveal } from '../todo-comment-reveal';
import { TodoCommentForm } from './todo-comment-form';

const DEFAULT_BOTTOM_INSET = 16;
const CLOSED_EXTRA_PADDING = 4;
const OPENED_BOTTOM_PADDING = 8;
const KEYBOARD_OPEN_PROGRESS = 1;
const EXTRA_PADDING_DURATION_MS = 150;

interface TodoCommentComposerBarProps {
  /** 키보드가 열린 채 작성기가 커지면 목록 끝을 그만큼 더 올린다 */
  extraContentPadding: SharedValue<number>;
}

/**
 * 목록 아래 한 번 놓이는 작성 바. 키보드를 UI 스레드에서 따라가고(KeyboardStickyView + useKeyboardHandler),
 * 아래 여백도 키보드 진행률로 바뀌어 JS 리렌더 없이 붙는다.
 */
export function TodoCommentComposerBar({ extraContentPadding }: TodoCommentComposerBarProps) {
  const insets = useSafeAreaInsets();
  const keyboardBottomGap = useKeyboardBottomGap();
  const isScreenFocused = useIsFocused();
  const { composerRef } = useTodoCommentReveal();
  const keyboardProgress = useSharedValue(0);
  const baselineHeightRef = useRef(0);
  const closedBottomPadding = (insets.bottom || DEFAULT_BOTTOM_INSET) + CLOSED_EXTRA_PADDING;

  useKeyboardHandler(
    {
      onMove: (event) => {
        'worklet';
        keyboardProgress.value = event.progress;
      },
      onEnd: (event) => {
        'worklet';
        keyboardProgress.value = event.progress;
      },
    },
    [],
  );

  const bottomSpacerStyle = useAnimatedStyle(() => ({
    height: interpolate(
      keyboardProgress.value,
      [0, KEYBOARD_OPEN_PROGRESS],
      [closedBottomPadding, OPENED_BOTTOM_PADDING],
    ),
  }));

  const setExtraContentPadding = useCallback(
    (padding: number) => {
      extraContentPadding.value = withTiming(padding, {
        duration: EXTRA_PADDING_DURATION_MS,
        reduceMotion: ReduceMotion.System,
      });
    },
    [extraContentPadding],
  );

  const handleContentLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { height } = event.nativeEvent.layout;
      if (keyboardProgress.value < KEYBOARD_OPEN_PROGRESS) {
        baselineHeightRef.current = height;
        setExtraContentPadding(0);
        return;
      }
      setExtraContentPadding(Math.max(height - baselineHeightRef.current, 0));
    },
    [keyboardProgress, setExtraContentPadding],
  );

  useEffect(
    () => () => {
      extraContentPadding.value = 0;
    },
    [extraContentPadding],
  );

  return (
    <KeyboardStickyView offset={{ closed: 0, opened: keyboardBottomGap }} enabled={isScreenFocused}>
      <Box px={12} pt={8} className="bg-background" testID="todo-comment-composer">
        <Box ref={composerRef} collapsable={false} onLayout={handleContentLayout}>
          <Suspense fallback={<TodoCommentComposerBar.Loading />}>
            <ComposerContent />
          </Suspense>
        </Box>
        <Animated.View style={bottomSpacerStyle} />
      </Box>
    </KeyboardStickyView>
  );
}

TodoCommentComposerBar.Loading = function Loading() {
  return <Skeleton className="h-14 w-full rounded-3xl" />;
};

function ComposerContent() {
  const { todoId } = useTodoScreenParams();
  const { t } = useTranslation('todoComment');
  const [{ data: detail }, { data: user }] = useSuspenseQueries({
    queries: [useGetTodoDetailsQueryOptions({ todoId }), useGetMeQueryOptions()],
  });

  if (!detail.permissions.canComment) {
    return (
      <Box py={8} className="items-center">
        <Text size="b4" shade={6}>
          {t('input.commentingDisabled')}
        </Text>
      </Box>
    );
  }

  return <TodoCommentForm author={user} userId={user.id} />;
}
