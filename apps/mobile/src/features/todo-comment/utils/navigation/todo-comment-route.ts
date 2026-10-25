import { TODO_COMMENT_SORT, todoCommentIdSchema, type TodoCommentSort } from '@aido/api';
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
/**
 * `screen`은 Stack 화면이다. 댓글 개요(`/todo/[todoId]`)에서 대화(`/todo/[todoId]/comments/[commentId]`)를
 * native push하고 뒤로가기는 pop이다. `pane`은 펼친 피드의 상세 영역이라 Stack이 없어 같은 URL의 search만 바꾼다.
 */
export type TodoCommentPresentation = 'screen' | 'pane';
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
  | { type: 'completeForm'; focusCommentId?: string }
  | { type: 'changeSort'; sort: TodoCommentSort };

export interface TodoCommentRouteParams {
  [key: string]: string | undefined;
  sort: TodoCommentSort;
  comment: string | undefined;
  intent: 'thread' | 'reply' | 'edit' | 'create' | undefined;
  returnTo: 'overview' | 'thread' | undefined;
}

/** 대화 화면 URL. 읽기만 하면 intent가 없고, 작성기를 연 채 진입하면 reply·edit와 복귀 문맥을 둔다. */
export interface TodoCommentThreadParams {
  [key: string]: string | number | undefined;
  commentId: string;
  sort: TodoCommentSort;
  intent: 'reply' | 'edit' | undefined;
  returnTo: 'overview' | 'thread' | undefined;
}

export type TodoCommentRouteNavigation =
  | { type: 'none' }
  | { type: 'setParams'; params: TodoCommentRouteParams | TodoCommentThreadParams }
  | {
      type: 'push';
      href: {
        pathname: '/todo/[todoId]/comments/[commentId]';
        params: TodoCommentThreadParams & { todoId: number };
      };
    }
  | { type: 'back' };

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
      if (route.form == null) {
        return route;
      }

      if (route.view === 'overview' || route.form.returnView === 'overview') {
        return createOverviewRoute(route.sort);
      }

      return { ...route, form: null };
    case 'completeForm':
      if (route.form == null) {
        return route;
      }

      // 답글을 게시하면 새 답글을 focus해 방금 쓴 글이 강조된 채 보이게 한다.
      return route.view === 'overview'
        ? createOverviewRoute(route.sort)
        : { ...route, commentId: action.focusCommentId ?? route.commentId, form: null };
    case 'changeSort':
      return route.sort === action.sort ? route : { ...route, sort: action.sort };
  }
}

export function serializeTodoCommentRoute(route: TodoCommentRoute): TodoCommentRouteParams {
  if (route.view === 'overview') {
    return {
      sort: route.sort,
      comment: undefined,
      intent: route.form == null ? undefined : 'create',
      returnTo: undefined,
    };
  }

  if (route.form == null) {
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

function serializeTodoCommentThreadRoute(
  route: Extract<TodoCommentRoute, { view: 'conversation' }>,
): TodoCommentThreadParams {
  return {
    commentId: route.commentId,
    sort: route.sort,
    intent: route.form?.type,
    returnTo:
      route.form == null ? undefined : route.form.returnView === 'overview' ? 'overview' : 'thread',
  };
}

/** 대화 화면 href. 알림과 댓글 개요가 같은 모양으로 대화를 연다. */
export function createTodoCommentThreadHref({
  todoId,
  route,
}: {
  todoId: number;
  route: Extract<TodoCommentRoute, { view: 'conversation' }>;
}): Extract<TodoCommentRouteNavigation, { type: 'push' }>['href'] {
  return {
    pathname: '/todo/[todoId]/comments/[commentId]',
    params: { todoId, ...serializeTodoCommentThreadRoute(route) },
  };
}

/**
 * 한 댓글 상태를 Stack 화면으로 열 때 쌓을 화면들. 대화는 개요 위에 쌓아 뒤로가기가 그 할 일의 댓글 개요로
 * 올라가게 한다. 펼친 pane에서 접힌 화면으로 넘길 때와 알림으로 열 때 같은 순서를 쓴다.
 */
export function createTodoCommentScreenHrefs({
  todoId,
  route,
}: {
  todoId: number;
  route: TodoCommentRoute;
}) {
  const overviewHref = {
    pathname: '/todo/[todoId]',
    params: {
      todoId,
      ...serializeTodoCommentRoute(
        route.view === 'overview' ? route : createOverviewRoute(route.sort),
      ),
    },
  } as const;

  return {
    overviewHref,
    threadHref:
      route.view === 'conversation' ? createTodoCommentThreadHref({ todoId, route }) : null,
  };
}

interface ResolveTodoCommentRouteNavigationParams {
  todoId: number;
  route: TodoCommentRoute;
  action: TodoCommentRouteAction;
  presentation: TodoCommentPresentation;
}

/**
 * 댓글 route 전이를 실제 이동 방법으로 바꾼다.
 * 화면은 개요 → 대화를 한 단계 push하고 대화 → 개요를 pop한다. 같은 대화 안의 focus·작성기 변화는
 * 현재 화면 search만 바꿔 history를 늘리지 않는다. pane은 Stack이 없어 모든 전이를 search로 처리한다.
 */
export function resolveTodoCommentRouteNavigation({
  todoId,
  route,
  action,
  presentation,
}: ResolveTodoCommentRouteNavigationParams): TodoCommentRouteNavigation {
  const nextRoute = reduceTodoCommentRoute(route, action);

  if (areTodoCommentRoutesEqual(route, nextRoute)) {
    return { type: 'none' };
  }

  if (presentation === 'pane') {
    return { type: 'setParams', params: serializeTodoCommentRoute(nextRoute) };
  }

  if (route.view === 'overview' && nextRoute.view === 'conversation') {
    return { type: 'push', href: createTodoCommentThreadHref({ todoId, route: nextRoute }) };
  }

  if (route.view === 'conversation' && nextRoute.view === 'overview') {
    return { type: 'back' };
  }

  return {
    type: 'setParams',
    params:
      nextRoute.view === 'conversation'
        ? serializeTodoCommentThreadRoute(nextRoute)
        : serializeTodoCommentRoute(nextRoute),
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

    if (firstRoute.form == null || secondRoute.form == null) {
      return firstRoute.form === secondRoute.form;
    }

    return (
      firstRoute.form.type === secondRoute.form.type &&
      firstRoute.form.returnView === secondRoute.form.returnView
    );
  }

  return false;
}
