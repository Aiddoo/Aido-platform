import type {
  TodoCommentPresentation,
  TodoCommentRoute,
  TodoCommentView,
} from './todo-comment-route';

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
  presentation: TodoCommentPresentation;
}

/**
 * 뒤로가기는 한 단계만 올라간다. 작성기는 연 문맥으로 닫고, 화면의 대화는 Stack pop으로 개요에 돌아가
 * 개요의 스크롤 위치를 그대로 보여 준다. pane은 Stack이 없어 같은 자리에서 개요로 바꾼다.
 */
export function getTodoCommentBackResult({
  route,
  isSubmitting,
  presentation,
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

  const returnView = route.form == null ? 'overview' : route.form.returnView;

  if (returnView === 'overview' && presentation === 'screen') {
    return { status: 'native' };
  }

  return returnView === 'overview'
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
