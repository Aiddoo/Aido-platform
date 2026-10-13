import type { TodoCommentRoute, TodoCommentView } from './todo-comment-route';

export type TodoCommentBackLabelKey =
  | 'screen.backToOverview'
  | 'screen.backToThread'
  | 'screen.closeForm';

export type TodoCommentBackResult =
  | { status: 'native' }
  | { status: 'blocked'; reason: 'comment-submitting' }
  | {
      status: 'navigate';
      destination: TodoCommentView;
      labelKey: TodoCommentBackLabelKey;
    };

interface GetTodoCommentBackResultParams {
  route: TodoCommentRoute;
  isSubmitting: boolean;
}

export function getTodoCommentBackResult({
  route,
  isSubmitting,
}: GetTodoCommentBackResultParams): TodoCommentBackResult {
  if (isSubmitting) {
    return { status: 'blocked', reason: 'comment-submitting' };
  }

  if (route.view === 'overview') {
    return route.form === null
      ? { status: 'native' }
      : {
          status: 'navigate',
          destination: 'overview',
          labelKey: 'screen.closeForm',
        };
  }

  if (route.form === null) {
    return {
      status: 'navigate',
      destination: 'overview',
      labelKey: 'screen.backToOverview',
    };
  }

  return route.form.returnView === 'overview'
    ? {
        status: 'navigate',
        destination: 'overview',
        labelKey: 'screen.backToOverview',
      }
    : {
        status: 'navigate',
        destination: 'conversation',
        labelKey: 'screen.backToThread',
      };
}
