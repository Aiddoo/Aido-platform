import { useTodoId } from '@src/features/planning/todo/hooks/use-todo-params';
import { useGetTodoDetailsQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { useTranslation } from '@src/shared/i18n';
import { useKeyboardBottomGap } from '@src/shared/providers/keyboard-bottom-gap-provider';
import { Box, Text } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import { Skeleton } from 'heroui-native';
import { useCallback, useEffect, useRef } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { KeyboardStickyView, useKeyboardHandler } from 'react-native-keyboard-controller';
import Animated, {
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TodoCommentForm } from './todo-comment-form';
import { useTodoCommentReveal } from './todo-comment-reveal';

const DEFAULT_BOTTOM_INSET = 16;
const CLOSED_EXTRA_PADDING = 4;
const OPENED_BOTTOM_PADDING = 8;
const KEYBOARD_OPEN_PROGRESS = 1;
const EXTRA_PADDING_DURATION_MS = 150;

/**
 * 목록 아래 한 번 놓이는 작성 바. 키보드를 UI 스레드에서 따라가고(KeyboardStickyView + useKeyboardHandler),
 * 아래 여백도 키보드 진행률로 바뀌어 JS 리렌더 없이 붙는다.
 */
export function TodoCommentComposerBar() {
  const { t } = useTranslation('todoComment');
  const [todoId] = useTodoId();
  const { data: detail } = useSuspenseQuery(useGetTodoDetailsQueryOptions({ todoId }));
  const insets = useSafeAreaInsets();
  const keyboardBottomGap = useKeyboardBottomGap();
  const isScreenFocused = useIsFocused();
  const { composerRef, extraContentPadding } = useTodoCommentReveal();
  const keyboardProgress = useSharedValue(0);
  const baselineHeightRef = useRef(0);
  const closedBottomPadding = getClosedBottomPadding(insets.bottom);

  useKeyboardHandler(
    {
      onMove: (event) => {
        'worklet';
        keyboardProgress.set(event.progress);
      },
      onEnd: (event) => {
        'worklet';
        keyboardProgress.set(event.progress);
      },
    },
    [],
  );

  const bottomSpacerStyle = useAnimatedStyle(() => ({
    height: interpolate(
      keyboardProgress.get(),
      [0, KEYBOARD_OPEN_PROGRESS],
      [closedBottomPadding, OPENED_BOTTOM_PADDING],
    ),
  }));

  const setExtraContentPadding = useCallback(
    (padding: number) => {
      extraContentPadding.set(
        withTiming(padding, {
          duration: EXTRA_PADDING_DURATION_MS,
          reduceMotion: ReduceMotion.System,
        }),
      );
    },
    [extraContentPadding],
  );

  const handleContentLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { height } = event.nativeEvent.layout;
      if (keyboardProgress.get() < KEYBOARD_OPEN_PROGRESS) {
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
      extraContentPadding.set(0);
    },
    [extraContentPadding],
  );

  return (
    <KeyboardStickyView offset={{ closed: 0, opened: keyboardBottomGap }} enabled={isScreenFocused}>
      <Box className="bg-white px-3 pt-2" testID="todo-comment-composer">
        <Box ref={composerRef} collapsable={false} onLayout={handleContentLayout}>
          {detail.permissions.canComment ? (
            <TodoCommentForm />
          ) : (
            <Box className="items-center py-2">
              <Text size="b4" shade={6}>
                {t('input.commentingDisabled')}
              </Text>
            </Box>
          )}
        </Box>
        <Animated.View style={bottomSpacerStyle} />
      </Box>
    </KeyboardStickyView>
  );
}

/** 작성 바와 같은 바탕·여백 위에 입력 자리를 잡는다. 키보드가 올라오기 전이라 따라가지 않는다 */
TodoCommentComposerBar.Loading = function Loading() {
  const insets = useSafeAreaInsets();

  return (
    <Box className="bg-white px-3 pt-2">
      <Skeleton className="h-14 w-full rounded-3xl" />
      <Box style={{ height: getClosedBottomPadding(insets.bottom) }} />
    </Box>
  );
};

/** 홈 인디케이터가 없는 기기(아래 inset 0)도 작성 바가 화면 끝에 붙지 않게 기본 여백을 둔다 */
function getClosedBottomPadding(bottomInset: number): number {
  return (bottomInset === 0 ? DEFAULT_BOTTOM_INSET : bottomInset) + CLOSED_EXTRA_PADDING;
}
