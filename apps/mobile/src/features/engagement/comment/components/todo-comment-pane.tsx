import { zodResolver } from '@hookform/resolvers/zod';
import { isTodoUnavailableError } from '@src/features/planning/todo/domains/todo.error';
import { useTodoId } from '@src/features/planning/todo/hooks/use-todo-params';
import { useGetTodoDetailsQueryOptions } from '@src/features/planning/todo/queries/todo.queries';
import { ANIMATION } from '@src/shared/constants/animation';
import { useAndroidBackHandler } from '@src/shared/hooks/use-android-back-handler';
import { useDismissKeyboard } from '@src/shared/hooks/use-dismiss-keyboard';
import { useTranslation } from '@src/shared/i18n';
import { useKeyboardBottomGap } from '@src/shared/providers/keyboard-bottom-gap-provider';
import { Box, QueryErrorBoundary, QueryErrorFallback, Text } from '@src/shared/ui';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useFocusEffect, useIsFocused } from 'expo-router';
import { Skeleton } from 'heroui-native';
import {
  type PropsWithChildren,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { useForm } from 'react-hook-form';
import { type LayoutChangeEvent, StyleSheet } from 'react-native';
import {
  KeyboardGestureArea,
  KeyboardStickyView,
  useKeyboardHandler,
} from 'react-native-keyboard-controller';
import Animated, {
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TODO_COMMENT_INPUT_NATIVE_ID } from '../constants/todo-comment.constants';
import { TodoCommentDeleteProvider } from '../hooks/use-confirm-todo-comment-delete';
import { useTodoCommentBack } from '../hooks/use-todo-comment-back';
import { TodoCommentFormProvider } from '../hooks/use-todo-comment-form';
import { useTodoCommentParams } from '../hooks/use-todo-comment-params';
import {
  EMPTY_TODO_COMMENT_FORM_VALUES,
  todoCommentFormSchema,
} from '../schemas/todo-comment-form.schema';
import { TodoCommentExpansionProvider } from './todo-comment-expansion';
import { TodoCommentForm } from './todo-comment-form';
import { TodoCommentRevealProvider, useTodoCommentReveal } from './todo-comment-reveal';
import { TodoCommentThreadList } from './todo-comment-thread-list';
import { TodoDetailSummary } from './todo-detail-summary';

const DEFAULT_BOTTOM_INSET = 16;
const CLOSED_EXTRA_PADDING = 4;
const OPENED_BOTTOM_PADDING = 8;
const KEYBOARD_OPEN_PROGRESS = 1;
const EXTRA_PADDING_DURATION_MS = ANIMATION.durationMs.fast;

const styles = StyleSheet.create({ gestureArea: { flex: 1 } });

interface TodoCommentPaneProps {
  /** 제목 줄. 상세 화면은 네이티브 헤더, 펼친 피드의 오른쪽 칸은 직접 그린 제목 줄이다 */
  titleBar: ReactNode;
  /** 지웠거나 볼 수 없는 할 일의 안내에서 닫을 때 */
  onClose: () => void;
  /** 댓글 세션에서 뒤로 갈 때. 없으면 화면의 뒤로 가기를 따른다 */
  onExit?: () => void;
}

/** 할 일 상세 칸 하나. 상세 화면과 펼친 피드의 오른쪽 칸이 같은 조립을 쓴다 */
export function TodoCommentPane({ titleBar, onClose, onExit }: TodoCommentPaneProps) {
  const [todoId] = useTodoId();
  const [{ sort, comment }] = useTodoCommentParams();

  return (
    <TodoCommentSession onExit={onExit}>
      {titleBar}

      <TodoAvailabilityGuard fallback={<TodoDetailSummary.Unavailable onClose={onClose} />}>
        <TodoCommentKeyboardGesture>
          {/* 본문·댓글·작성 바를 기다리는 경계는 하나다. 여럿이 함께 기다리면 React 19가 서로의 재시도를 번갈아 그려 응답 전까지 렌더가 끝나지 않는다 */}
          <QueryErrorBoundary resetKeys={[todoId]} fallback={TodoCommentPane.Error}>
            <Suspense fallback={<TodoCommentPane.Loading />}>
              {/* 목록 머리가 본문(상세)을 함께 그린다. 상세 오류는 이 경계의 fallback 머리가 다시 던져 칸 경계가 받고, 다시 시도 범위는 칸과 함께 쓴다 */}
              <QueryErrorBoundary
                resetKeys={[todoId, sort, comment]}
                resetScope="parent"
                fallback={TodoCommentThreadList.Error}
              >
                <TodoCommentThreadList />
              </QueryErrorBoundary>

              <TodoCommentComposerBar />
            </Suspense>
          </QueryErrorBoundary>
        </TodoCommentKeyboardGesture>
      </TodoAvailabilityGuard>
    </TodoCommentSession>
  );
}

TodoCommentPane.Error = QueryErrorFallback;

TodoCommentPane.Loading = function Loading() {
  return (
    <>
      <TodoCommentThreadList.Loading />
      <TodoCommentComposerBar.Loading />
    </>
  );
};

interface TodoCommentSessionProps extends PropsWithChildren {
  /** 더 닫을 게 없을 때 Android 뒤로가기가 부르는 일. 펼친 피드 칸은 선택을 풀고, 전체 화면은 기본 뒤로가기다 */
  onExit?: () => void;
}

/** 한 할 일의 작성기(새 댓글·답글·수정) 폼과 펼친 묶음, 키보드 위치·강조, 삭제 확인을 그 아래 조각들이 함께 쓴다 */
function TodoCommentSession({ onExit, children }: TodoCommentSessionProps) {
  const form = useForm({
    resolver: zodResolver(todoCommentFormSchema),
    defaultValues: EMPTY_TODO_COMMENT_FORM_VALUES,
    mode: 'onChange',
  });

  return (
    <TodoCommentFormProvider form={form}>
      <TodoCommentRevealProvider>
        <TodoCommentExpansionProvider>
          <TodoCommentDeleteProvider>
            <BackAndKeyboardEffects onExit={onExit} />
            {children}
          </TodoCommentDeleteProvider>
        </TodoCommentExpansionProvider>
      </TodoCommentRevealProvider>
    </TodoCommentFormProvider>
  );
}

function BackAndKeyboardEffects({ onExit }: Pick<TodoCommentSessionProps, 'onExit'>) {
  const dismissKeyboard = useDismissKeyboard();

  useAndroidTodoCommentBackHandler({ onExit });

  // 작성 중에 알림이나 다른 화면이 위에 쌓이면 가려진 작성기가 first responder로 남아 새 화면 위에 키보드가
  // 떠 있다. 화면이 focus를 잃을 때 키보드를 내린다. 작성 내용은 초안 저장소에 남는다.
  useFocusEffect(
    // 콜백이 바뀌면 useFocusEffect가 정리 함수를 다시 돌려 키보드를 내리므로 고정한다
    useCallback(
      () => () => {
        dismissKeyboard();
      },
      [dismissKeyboard],
    ),
  );

  return null;
}

interface TodoAvailabilityGuardProps extends PropsWithChildren {
  /** 지운 할 일과 볼 권한이 없는 할 일에 본문·댓글 대신 보이는 안내 */
  fallback: ReactNode;
}

/** 지운 할 일과 볼 권한이 없는 할 일은 같은 오류다. 화면은 본문·댓글 대신 안내 하나만 보인다 */
function TodoAvailabilityGuard({ fallback, children }: TodoAvailabilityGuardProps) {
  const [todoId] = useTodoId();
  const { error } = useQuery(useGetTodoDetailsQueryOptions({ todoId }));

  if (isTodoUnavailableError(error)) {
    return fallback;
  }

  return children;
}

/** 목록과 작성 바를 함께 감싸 Android에서 키보드를 손가락으로 끌어 내리게 한다 */
function TodoCommentKeyboardGesture({ children }: PropsWithChildren) {
  return (
    <KeyboardGestureArea
      style={styles.gestureArea}
      textInputNativeID={TODO_COMMENT_INPUT_NATIVE_ID}
    >
      <Box flex={1} testID="todo-comment-threads">
        {children}
      </Box>
    </KeyboardGestureArea>
  );
}

/**
 * 목록 아래 한 번 놓이는 작성 바. 키보드를 UI 스레드에서 따라가고(KeyboardStickyView + useKeyboardHandler),
 * 아래 여백도 키보드 진행률로 바뀌어 JS 리렌더 없이 붙는다.
 */
function TodoCommentComposerBar() {
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

  const setExtraContentPadding = (padding: number) => {
    extraContentPadding.set(
      withTiming(padding, {
        duration: EXTRA_PADDING_DURATION_MS,
        reduceMotion: ReduceMotion.System,
      }),
    );
  };

  const handleContentLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    if (keyboardProgress.get() < KEYBOARD_OPEN_PROGRESS) {
      baselineHeightRef.current = height;
      setExtraContentPadding(0);

      return;
    }
    setExtraContentPadding(Math.max(height - baselineHeightRef.current, 0));
  };

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

/** 화면에 focus가 있을 때만 듣는다 */
function useAndroidTodoCommentBackHandler({ onExit }: Pick<TodoCommentSessionProps, 'onExit'>) {
  const { interceptBack } = useTodoCommentBack();
  useAndroidBackHandler({
    onBack: () => {
      if (interceptBack()) {
        return true;
      }
      // 화면이 처리하지 않은 뒤로가기는 pane이면 선택만 풀고, 화면이면 기본 뒤로가기에 맡긴다
      onExit?.();
      return onExit != null;
    },
  });
}

/** 홈 인디케이터가 없는 기기(아래 inset 0)도 작성 바가 화면 끝에 붙지 않게 기본 여백을 둔다 */
function getClosedBottomPadding(bottomInset: number): number {
  return (bottomInset === 0 ? DEFAULT_BOTTOM_INSET : bottomInset) + CLOSED_EXTRA_PADDING;
}
