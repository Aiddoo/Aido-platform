import type { BlockTarget } from '../../domains/user-block.model';

export function todoReportSheetHref({ todoId }: { todoId: number }) {
  return { pathname: '/todo/[todoId]/report', params: { todoId } } as const;
}

export function commentReportSheetHref({
  todoId,
  commentId,
}: {
  todoId: number;
  commentId: string;
}) {
  return {
    pathname: '/todo/[todoId]/comments/[commentId]/report',
    params: { todoId, commentId },
  } as const;
}

/** 차단 확인은 시트·토스트 어디서 열어도 같은 화면 위에 뜨도록 route로 띄운다 */
export function blockUserConfirmHref({ userId, displayName }: BlockTarget) {
  return { pathname: '/users/[userId]/block', params: { userId, name: displayName } } as const;
}
