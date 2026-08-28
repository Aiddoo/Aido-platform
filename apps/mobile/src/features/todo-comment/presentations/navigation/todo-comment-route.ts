import { TODO_COMMENT_SORT, todoCommentIdSchema, type TodoCommentSort } from '@aido/validators';
import { z } from 'zod';

const todoCommentSortSchema = z
  .enum(TODO_COMMENT_SORT)
  .default(TODO_COMMENT_SORT.LATEST)
  .catch(TODO_COMMENT_SORT.LATEST);
const todoCommentIntentSchema = z.enum(['thread', 'reply', 'edit', 'create']);
const todoCommentReturnViewSchema = z.enum(['overview', 'thread']);
const rawTodoCommentRouteSchema = z
  .object({
    sort: z.unknown().optional(),
    comment: z.unknown().optional(),
    intent: z.unknown().optional(),
    returnTo: z.unknown().optional(),
  })
  .catch({});

export type TodoCommentView = 'overview' | 'conversation';
export type TodoCommentNavigationDestination = 'conversation' | 'reply' | 'edit';

export type TodoCommentRoute =
  | {
      sort: TodoCommentSort;
      view: 'overview';
      form: null | { type: 'new' };
    }
  | {
      sort: TodoCommentSort;
      view: 'conversation';
      commentId: string;
      form: null | { type: 'reply' | 'edit'; returnView: TodoCommentView };
    };

export type TodoCommentRouteAction =
  | { type: 'showOverview' }
  | { type: 'openConversation'; commentId: string }
  | { type: 'startNewComment' }
  | { type: 'startReply'; commentId: string }
  | { type: 'startEdit'; commentId: string }
  | { type: 'cancelForm' }
  | { type: 'completeForm' }
  | { type: 'changeSort'; sort: TodoCommentSort };

export interface TodoCommentRouteParams {
  [key: string]: string | undefined;
  sort: TodoCommentSort;
  comment: string | undefined;
  intent: 'thread' | 'reply' | 'edit' | 'create' | undefined;
  returnTo: 'overview' | 'thread' | undefined;
}

function createOverviewRoute(sort: TodoCommentSort): TodoCommentRoute {
  return { sort, view: 'overview', form: null };
}

function getFormReturnView(route: TodoCommentRoute): TodoCommentView {
  if (route.view === 'overview') {
    return 'overview';
  }

  return route.form?.type === 'reply' || route.form?.type === 'edit'
    ? route.form.returnView
    : 'conversation';
}

export function parseTodoCommentRoute(params: unknown): TodoCommentRoute {
  const rawRoute = rawTodoCommentRouteSchema.parse(params);
  const sort = todoCommentSortSchema.parse(rawRoute.sort);
  const hasComment = rawRoute.comment !== undefined;
  const hasIntent = rawRoute.intent !== undefined;

  if (!hasComment && !hasIntent) {
    return createOverviewRoute(sort);
  }

  const parsedCommentId = todoCommentIdSchema.safeParse(rawRoute.comment);
  const parsedIntent = todoCommentIntentSchema.safeParse(rawRoute.intent);

  if ((hasComment && !parsedCommentId.success) || (hasIntent && !parsedIntent.success)) {
    return createOverviewRoute(sort);
  }

  // comment-only 알림 URL도 한 대화 보기로 정규화한다.
  if (parsedCommentId.success && !hasIntent) {
    return {
      sort,
      view: 'conversation',
      commentId: parsedCommentId.data,
      form: null,
    };
  }

  if (!hasComment && parsedIntent.success && parsedIntent.data === 'create') {
    return { sort, view: 'overview', form: { type: 'new' } };
  }

  if (!parsedCommentId.success || !parsedIntent.success || parsedIntent.data === 'create') {
    return createOverviewRoute(sort);
  }

  if (parsedIntent.data === 'thread') {
    return {
      sort,
      view: 'conversation',
      commentId: parsedCommentId.data,
      form: null,
    };
  }

  const parsedReturnView = todoCommentReturnViewSchema.safeParse(rawRoute.returnTo);

  return {
    sort,
    view: 'conversation',
    commentId: parsedCommentId.data,
    form: {
      type: parsedIntent.data,
      // returnTo가 없던 기존 URL의 reply/edit → thread 동작을 보존한다.
      returnView:
        parsedReturnView.success && parsedReturnView.data === 'overview'
          ? 'overview'
          : 'conversation',
    },
  };
}

export function reduceTodoCommentRoute(
  route: TodoCommentRoute,
  action: TodoCommentRouteAction,
): TodoCommentRoute {
  switch (action.type) {
    case 'showOverview':
      return createOverviewRoute(route.sort);
    case 'openConversation':
      return {
        sort: route.sort,
        view: 'conversation',
        commentId: action.commentId,
        form: null,
      };
    case 'startNewComment':
      return { sort: route.sort, view: 'overview', form: { type: 'new' } };
    case 'startReply':
    case 'startEdit':
      return {
        sort: route.sort,
        view: 'conversation',
        commentId: action.commentId,
        form: {
          type: action.type === 'startReply' ? 'reply' : 'edit',
          returnView: getFormReturnView(route),
        },
      };
    case 'cancelForm':
      if (route.form === null) {
        return route;
      }

      if (route.view === 'overview' || route.form.returnView === 'overview') {
        return createOverviewRoute(route.sort);
      }

      return { ...route, form: null };
    case 'completeForm':
      if (route.form === null) {
        return route;
      }

      return route.view === 'overview' ? createOverviewRoute(route.sort) : { ...route, form: null };
    case 'changeSort':
      return route.sort === action.sort ? route : { ...route, sort: action.sort };
  }
}

export function serializeTodoCommentRoute(route: TodoCommentRoute): TodoCommentRouteParams {
  if (route.view === 'overview') {
    return {
      sort: route.sort,
      comment: undefined,
      intent: route.form === null ? undefined : 'create',
      returnTo: undefined,
    };
  }

  if (route.form === null) {
    return {
      sort: route.sort,
      comment: route.commentId,
      intent: 'thread',
      returnTo: undefined,
    };
  }

  return {
    sort: route.sort,
    comment: route.commentId,
    intent: route.form.type,
    returnTo: route.form.returnView === 'overview' ? 'overview' : 'thread',
  };
}

export function areTodoCommentRoutesEqual(
  firstRoute: TodoCommentRoute,
  secondRoute: TodoCommentRoute,
): boolean {
  if (firstRoute.sort !== secondRoute.sort || firstRoute.view !== secondRoute.view) {
    return false;
  }

  if (firstRoute.view === 'overview' && secondRoute.view === 'overview') {
    return firstRoute.form?.type === secondRoute.form?.type;
  }

  if (firstRoute.view === 'conversation' && secondRoute.view === 'conversation') {
    if (firstRoute.commentId !== secondRoute.commentId) {
      return false;
    }

    if (firstRoute.form === null || secondRoute.form === null) {
      return firstRoute.form === secondRoute.form;
    }

    return (
      firstRoute.form.type === secondRoute.form.type &&
      firstRoute.form.returnView === secondRoute.form.returnView
    );
  }

  return false;
}
