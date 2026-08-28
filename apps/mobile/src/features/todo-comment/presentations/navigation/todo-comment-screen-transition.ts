import type { TodoCommentSort } from '@aido/validators';

import {
  areTodoCommentRoutesEqual,
  type TodoCommentNavigationDestination,
  type TodoCommentRoute,
} from './todo-comment-route';

export interface TodoCommentScreenState {
  todoId: number;
  route: TodoCommentRoute;
}

export type PendingTodoCommentTransition =
  | {
      type: 'commentNavigation';
      startedFrom: TodoCommentScreenState;
      commentId: string;
      destination: TodoCommentNavigationDestination;
    }
  | {
      type: 'sortChange';
      startedFrom: TodoCommentScreenState;
      nextSort: TodoCommentSort;
    };

export type TodoCommentNavigationTransition = Extract<
  PendingTodoCommentTransition,
  { type: 'commentNavigation' }
>;
export type TodoCommentSortChangeTransition = Extract<
  PendingTodoCommentTransition,
  { type: 'sortChange' }
>;

export type TodoCommentTransitionBlockReason = 'comment-submitting' | 'comment-form-active';

type TodoCommentTransitionBlockedResult = {
  status: 'blocked';
  reason: TodoCommentTransitionBlockReason;
};

export type TodoCommentNavigationStartResult =
  | { status: 'started'; transition: TodoCommentNavigationTransition }
  | TodoCommentTransitionBlockedResult
  | { status: 'ignored'; reason: 'duplicate-transition' };

export type TodoCommentSortChangeStartResult =
  | { status: 'started'; transition: TodoCommentSortChangeTransition }
  | TodoCommentTransitionBlockedResult
  | { status: 'ignored'; reason: 'transition-in-progress' | 'same-sort' };

export type TodoCommentTransitionFinishResult = { status: 'committed' } | { status: 'stale' };

export type TodoCommentNavigationAvailability =
  | { status: 'available' }
  | { status: 'blocked'; reason: TodoCommentTransitionBlockReason };

interface GetTodoCommentNavigationAvailabilityParams {
  route: TodoCommentRoute;
  destination: TodoCommentNavigationDestination;
  isSubmitting: boolean;
}

export function getTodoCommentNavigationAvailability({
  route,
  destination,
  isSubmitting,
}: GetTodoCommentNavigationAvailabilityParams): TodoCommentNavigationAvailability {
  if (isSubmitting) {
    return { status: 'blocked', reason: 'comment-submitting' };
  }

  if (route.form === null) {
    return { status: 'available' };
  }

  if (route.form.type === 'reply' && destination === 'reply') {
    return { status: 'available' };
  }

  return { status: 'blocked', reason: 'comment-form-active' };
}

interface StartTodoCommentNavigationParams {
  currentScreen: TodoCommentScreenState;
  pendingTransition: PendingTodoCommentTransition | null;
  commentId: string;
  destination: TodoCommentNavigationDestination;
  isSubmitting: boolean;
}

export function startTodoCommentNavigation({
  currentScreen,
  pendingTransition,
  commentId,
  destination,
  isSubmitting,
}: StartTodoCommentNavigationParams): TodoCommentNavigationStartResult {
  const availability = getTodoCommentNavigationAvailability({
    route: currentScreen.route,
    destination,
    isSubmitting,
  });

  if (availability.status === 'blocked') {
    return availability;
  }

  if (
    pendingTransition?.type === 'commentNavigation' &&
    pendingTransition.commentId === commentId &&
    pendingTransition.destination === destination
  ) {
    return { status: 'ignored', reason: 'duplicate-transition' };
  }

  return {
    status: 'started',
    transition: {
      type: 'commentNavigation',
      startedFrom: currentScreen,
      commentId,
      destination,
    },
  };
}

interface StartTodoCommentSortChangeParams {
  currentScreen: TodoCommentScreenState;
  pendingTransition: PendingTodoCommentTransition | null;
  nextSort: TodoCommentSort;
  isSubmitting: boolean;
}

export function startTodoCommentSortChange({
  currentScreen,
  pendingTransition,
  nextSort,
  isSubmitting,
}: StartTodoCommentSortChangeParams): TodoCommentSortChangeStartResult {
  if (isSubmitting) {
    return { status: 'blocked', reason: 'comment-submitting' };
  }

  if (currentScreen.route.form !== null) {
    return { status: 'blocked', reason: 'comment-form-active' };
  }

  if (currentScreen.route.sort === nextSort) {
    return { status: 'ignored', reason: 'same-sort' };
  }

  if (pendingTransition !== null) {
    return { status: 'ignored', reason: 'transition-in-progress' };
  }

  return {
    status: 'started',
    transition: {
      type: 'sortChange',
      startedFrom: currentScreen,
      nextSort,
    },
  };
}

interface FinishTodoCommentTransitionParams {
  currentScreen: TodoCommentScreenState;
  pendingTransition: PendingTodoCommentTransition | null;
  transition: PendingTodoCommentTransition;
}

export function finishTodoCommentTransition({
  currentScreen,
  pendingTransition,
  transition,
}: FinishTodoCommentTransitionParams): TodoCommentTransitionFinishResult {
  if (
    pendingTransition !== transition ||
    pendingTransition.startedFrom.todoId !== currentScreen.todoId ||
    !areTodoCommentRoutesEqual(pendingTransition.startedFrom.route, currentScreen.route)
  ) {
    return { status: 'stale' };
  }

  return { status: 'committed' };
}

export function areTodoCommentScreenStatesEqual(
  firstScreen: TodoCommentScreenState,
  secondScreen: TodoCommentScreenState,
): boolean {
  return (
    firstScreen.todoId === secondScreen.todoId &&
    areTodoCommentRoutesEqual(firstScreen.route, secondScreen.route)
  );
}
