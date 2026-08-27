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

import { useCommentRouteState } from '../hooks/use-comment-route-state';
import { useIsTodoCommentComposerMutating } from '../hooks/use-is-todo-comment-composer-mutating';

type CommentNavigationDestination = 'thread' | 'reply' | 'edit';

interface PendingCommentNavigation {
  requestId: number;
  commentId: string;
  destination: CommentNavigationDestination;
  routeIdentity: string;
}

interface PendingScreenTransition {
  requestId: number;
  routeIdentity: string;
}

interface TodoCommentScreenTransition {
  pendingCommentId: string | null;
  isNavigationBlocked: boolean;
  beginCommentNavigation: (
    commentId: string,
    destination: CommentNavigationDestination,
  ) => number | null;
  completeCommentNavigation: (requestId: number) => boolean;
  beginSortTransition: () => number | null;
  completeSortTransition: (requestId: number) => boolean;
  cancelTransition: () => void;
}

const TodoCommentScreenTransitionContext = createContext<TodoCommentScreenTransition | null>(null);

function useTodoCommentScreenTransitionContext(): TodoCommentScreenTransition {
  const transition = useContext(TodoCommentScreenTransitionContext);
  if (transition === null) {
    throw new Error(
      '댓글 화면 전환 상태는 TodoCommentScreenTransitionProvider 안에서 사용해 주세요.',
    );
  }
  return transition;
}

export function TodoCommentScreenTransitionProvider({ children }: PropsWithChildren) {
  const { todoId } = useTodoScreenParams();
  const route = useCommentRouteState();
  const isComposerMutating = useIsTodoCommentComposerMutating();
  const isComposerActive =
    route.mode === 'create' || route.mode === 'reply' || route.mode === 'edit';
  const isNavigationBlocked = isComposerMutating || isComposerActive;
  const requestSequenceRef = useRef(0);
  const pendingNavigationRef = useRef<PendingCommentNavigation | null>(null);
  const pendingScreenTransitionRef = useRef<PendingScreenTransition | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<PendingCommentNavigation | null>(null);
  const routeIdentity = `${todoId}:${route.sort}:${route.mode}:${route.anchorCommentId ?? 'none'}`;
  const currentRouteIdentityRef = useRef(routeIdentity);

  const cancelTransition = useCallback(() => {
    requestSequenceRef.current += 1;
    pendingScreenTransitionRef.current = null;

    if (pendingNavigationRef.current === null) {
      return;
    }
    pendingNavigationRef.current = null;
    setPendingNavigation(null);
  }, []);

  const beginCommentNavigation = useCallback(
    (commentId: string, destination: CommentNavigationDestination): number | null => {
      if (isNavigationBlocked) {
        return null;
      }

      const current = pendingNavigationRef.current;
      if (current?.commentId === commentId && current.destination === destination) {
        return null;
      }

      requestSequenceRef.current += 1;
      pendingScreenTransitionRef.current = null;
      const next = {
        requestId: requestSequenceRef.current,
        commentId,
        destination,
        routeIdentity: currentRouteIdentityRef.current,
      };
      pendingNavigationRef.current = next;
      setPendingNavigation(next);
      return next.requestId;
    },
    [isNavigationBlocked],
  );

  const completeCommentNavigation = useCallback((requestId: number): boolean => {
    const pending = pendingNavigationRef.current;
    if (
      pending?.requestId !== requestId ||
      pending.routeIdentity !== currentRouteIdentityRef.current
    ) {
      return false;
    }

    pendingNavigationRef.current = null;
    setPendingNavigation(null);
    return true;
  }, []);

  const beginSortTransition = useCallback((): number | null => {
    if (isNavigationBlocked || pendingScreenTransitionRef.current !== null) {
      return null;
    }

    requestSequenceRef.current += 1;
    const next = {
      requestId: requestSequenceRef.current,
      routeIdentity: currentRouteIdentityRef.current,
    };
    pendingScreenTransitionRef.current = next;

    if (pendingNavigationRef.current !== null) {
      pendingNavigationRef.current = null;
      setPendingNavigation(null);
    }

    return next.requestId;
  }, [isNavigationBlocked]);

  const completeSortTransition = useCallback((requestId: number): boolean => {
    const pending = pendingScreenTransitionRef.current;
    if (
      pending?.requestId !== requestId ||
      pending.routeIdentity !== currentRouteIdentityRef.current ||
      requestSequenceRef.current !== requestId
    ) {
      return false;
    }

    pendingScreenTransitionRef.current = null;
    return true;
  }, []);

  useLayoutEffect(() => {
    if (currentRouteIdentityRef.current === routeIdentity) {
      return;
    }

    currentRouteIdentityRef.current = routeIdentity;
    cancelTransition();
  }, [cancelTransition, routeIdentity]);

  useLayoutEffect(() => {
    if (isNavigationBlocked) {
      cancelTransition();
    }
  }, [cancelTransition, isNavigationBlocked]);

  useEffect(() => cancelTransition, [cancelTransition]);

  const transition = useMemo(
    () => ({
      pendingCommentId: pendingNavigation?.commentId ?? null,
      isNavigationBlocked,
      beginCommentNavigation,
      completeCommentNavigation,
      beginSortTransition,
      completeSortTransition,
      cancelTransition,
    }),
    [
      beginCommentNavigation,
      beginSortTransition,
      cancelTransition,
      completeCommentNavigation,
      completeSortTransition,
      isNavigationBlocked,
      pendingNavigation?.commentId,
    ],
  );

  return (
    <TodoCommentScreenTransitionContext value={transition}>
      {children}
    </TodoCommentScreenTransitionContext>
  );
}

export function useTodoCommentScreenTransition(): TodoCommentScreenTransition {
  return useTodoCommentScreenTransitionContext();
}

export function useCancelTodoCommentScreenTransition(): () => void {
  return useTodoCommentScreenTransitionContext().cancelTransition;
}
