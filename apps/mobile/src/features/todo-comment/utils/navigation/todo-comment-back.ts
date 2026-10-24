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

export type HardwareBackAction = 'consume' | 'exit' | 'native';

interface ResolveHardwareBackActionParams {
  isHandledByComment: boolean;
  canExit: boolean;
}

/** 댓글 단계(작성기 → 대화 → 개요)를 먼저 되돌리고, 더 되돌릴 게 없으면 pane만 닫는다. pane이 아니면 기본 뒤로가기에 맡긴다. */
export function resolveHardwareBackAction({
  isHandledByComment,
  canExit,
}: ResolveHardwareBackActionParams): HardwareBackAction {
  if (isHandledByComment) {
    return 'consume';
  }

  return canExit ? 'exit' : 'native';
}

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
    return route.form == null
      ? { status: 'native' }
      : {
          status: 'navigate',
          destination: 'overview',
          labelKey: 'screen.closeForm',
        };
  }

  if (route.form == null) {
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
