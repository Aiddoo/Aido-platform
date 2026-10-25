import type { WindowSizeClass } from '@src/shared/utils/window-size-class';

export type FeedTodoSelectionNavigation =
  | { type: 'none' }
  | { type: 'push'; todoId: number }
  | {
      type: 'setParams';
      params: {
        todoId: string | undefined;
        comment: undefined;
        intent: undefined;
        returnTo: undefined;
      };
    };

/**
 * 접힌 화면은 상세 라우트로 push하고, 펼친 화면은 피드 URL param으로 pane을 바꾼다.
 * 펼친 화면에서 다른 할 일을 고르면 이전 할 일의 댓글 URL 상태는 버린다.
 */
export function resolveFeedTodoSelection(
  windowSizeClass: WindowSizeClass,
  todoId: number | undefined,
): FeedTodoSelectionNavigation {
  if (windowSizeClass === 'compact') {
    return todoId == null ? { type: 'none' } : { type: 'push', todoId };
  }

  return {
    type: 'setParams',
    params: {
      todoId: todoId == null ? undefined : String(todoId),
      comment: undefined,
      intent: undefined,
      returnTo: undefined,
    },
  };
}
