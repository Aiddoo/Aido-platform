import { useTodoScreenParams } from '@src/features/todo/presentations/hooks/use-todo-screen-params';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIsTodoCommentSubmitting } from '../hooks/use-is-todo-comment-submitting';
import { useTodoCommentRoute } from '../hooks/use-todo-comment-route';
import type {
  TodoCommentNavigationDestination,
  TodoCommentRoute,
} from '../navigation/todo-comment-route';
import {
  areTodoCommentScreenStatesEqual,
  finishTodoCommentTransition,
  getTodoCommentNavigationAvailability,
  startTodoCommentNavigation,
  startTodoCommentSortChange,
  type PendingTodoCommentTransition,
  type TodoCommentNavigationAvailability,
  type TodoCommentNavigationStartResult,
  type TodoCommentScreenState,
  type TodoCommentSortChangeStartResult,
  type TodoCommentTransitionFinishResult,
} from '../navigation/todo-comment-screen-transition';

interface StartCommentNavigationParams {
  commentId: string;
  destination: TodoCommentNavigationDestination;
}

interface StartSortChangeParams {
  nextSort: TodoCommentRoute['sort'];
}

interface TodoCommentScreenTransitionActions {
  getCommentNavigationAvailability: (
    destination: TodoCommentNavigationDestination,
  ) => TodoCommentNavigationAvailability;
  startCommentNavigation: (
    params: StartCommentNavigationParams,
  ) => TodoCommentNavigationStartResult;
  startSortChange: (params: StartSortChangeParams) => TodoCommentSortChangeStartResult;
  finishTransition: (transition: PendingTodoCommentTransition) => TodoCommentTransitionFinishResult;
  cancelPendingTransition: () => boolean;
}

const TodoCommentScreenTransitionActionsContext =
  createContext<TodoCommentScreenTransitionActions | null>(null);
const TodoCommentPendingTransitionContext = createContext<
  PendingTodoCommentTransition | null | undefined
>(undefined);

function useTodoCommentScreenTransitionActionsContext(): TodoCommentScreenTransitionActions {
  const actions = useContext(TodoCommentScreenTransitionActionsContext);

  if (actions === null) {
    throw new Error(
      '댓글 화면 전환 액션은 TodoCommentScreenTransitionProvider 안에서 사용해 주세요.',
    );
  }

  return actions;
}

export function TodoCommentScreenTransitionProvider({ children }: PropsWithChildren) {
  const { todoId } = useTodoScreenParams();
  const [commentRoute] = useTodoCommentRoute();
  const isSubmitting = useIsTodoCommentSubmitting();
  const currentScreen = useMemo<TodoCommentScreenState>(
    () => ({ todoId, route: commentRoute }),
    [commentRoute, todoId],
  );
  const currentScreenRef = useRef(currentScreen);
  const pendingTransitionRef = useRef<PendingTodoCommentTransition | null>(null);
  const [pendingTransition, setPendingTransition] = useState<PendingTodoCommentTransition | null>(
    null,
  );

  const cancelPendingTransition = useCallback(() => {
    if (pendingTransitionRef.current === null) {
      return false;
    }

    pendingTransitionRef.current = null;
    setPendingTransition(null);
    return true;
  }, []);

  const getCommentNavigationAvailabilityForCurrentScreen = useCallback(
    (destination: TodoCommentNavigationDestination) =>
      getTodoCommentNavigationAvailability({
        route: commentRoute,
        destination,
        isSubmitting,
      }),
    [commentRoute, isSubmitting],
  );

  const startCommentNavigation = useCallback(
    ({ commentId, destination }: StartCommentNavigationParams) => {
      const result = startTodoCommentNavigation({
        currentScreen,
        pendingTransition: pendingTransitionRef.current,
        commentId,
        destination,
        isSubmitting,
      });

      if (result.status === 'started') {
        pendingTransitionRef.current = result.transition;
        setPendingTransition(result.transition);
      }

      return result;
    },
    [currentScreen, isSubmitting],
  );

  const startSortChange = useCallback(
    ({ nextSort }: StartSortChangeParams) => {
      const result = startTodoCommentSortChange({
        currentScreen,
        pendingTransition: pendingTransitionRef.current,
        nextSort,
        isSubmitting,
      });

      if (result.status === 'started') {
        pendingTransitionRef.current = result.transition;
        setPendingTransition(result.transition);
      }

      return result;
    },
    [currentScreen, isSubmitting],
  );

  const finishTransition = useCallback((transition: PendingTodoCommentTransition) => {
    const result = finishTodoCommentTransition({
      currentScreen: currentScreenRef.current,
      pendingTransition: pendingTransitionRef.current,
      transition,
    });

    if (result.status === 'committed') {
      pendingTransitionRef.current = null;
      setPendingTransition(null);
    }

    return result;
  }, []);

  useLayoutEffect(() => {
    const previousScreen = currentScreenRef.current;
    currentScreenRef.current = currentScreen;

    if (!areTodoCommentScreenStatesEqual(previousScreen, currentScreen)) {
      cancelPendingTransition();
    }
  }, [cancelPendingTransition, currentScreen]);

  useLayoutEffect(() => {
    if (isSubmitting) {
      cancelPendingTransition();
    }
  }, [cancelPendingTransition, isSubmitting]);

  useEffect(
    () => () => {
      // unmount 뒤 끝난 비동기 준비가 route를 commit하지 못하게 token만 폐기한다.
      pendingTransitionRef.current = null;
    },
    [],
  );

  const transitionActions = useMemo(
    () => ({
      getCommentNavigationAvailability: getCommentNavigationAvailabilityForCurrentScreen,
      startCommentNavigation,
      startSortChange,
      finishTransition,
      cancelPendingTransition,
    }),
    [
      cancelPendingTransition,
      finishTransition,
      getCommentNavigationAvailabilityForCurrentScreen,
      startCommentNavigation,
      startSortChange,
    ],
  );

  return (
    <TodoCommentScreenTransitionActionsContext value={transitionActions}>
      <TodoCommentPendingTransitionContext value={pendingTransition}>
        {children}
      </TodoCommentPendingTransitionContext>
    </TodoCommentScreenTransitionActionsContext>
  );
}

export function useTodoCommentScreenTransitionActions(): TodoCommentScreenTransitionActions {
  return useTodoCommentScreenTransitionActionsContext();
}

export function usePendingTodoCommentTransition(): PendingTodoCommentTransition | null {
  const pendingTransition = useContext(TodoCommentPendingTransitionContext);

  if (pendingTransition === undefined) {
    throw new Error(
      '댓글 화면 전환 상태는 TodoCommentScreenTransitionProvider 안에서 사용해 주세요.',
    );
  }

  return pendingTransition;
}

export function useCancelTodoCommentScreenTransition(): () => boolean {
  return useTodoCommentScreenTransitionActionsContext().cancelPendingTransition;
}
