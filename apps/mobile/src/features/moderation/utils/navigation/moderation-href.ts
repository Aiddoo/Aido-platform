import type { BlockTarget } from '../../domains/user-block.model';
import type { UserReportTarget } from '../../domains/user-report.model';

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

/** 프로필·콕·응원 메시지 신고. 할 일·댓글처럼 상위 화면이 없는 대상이라 사람 기준 route로 연다 */
export function userReportSheetHref({
  target,
  displayName,
}: {
  target: UserReportTarget;
  displayName: string;
}) {
  return {
    pathname: '/users/[userId]/report',
    params: {
      userId: target.targetUserId,
      name: displayName,
      targetType: target.targetType,
      ...(target.targetId == null ? {} : { targetId: target.targetId }),
    },
  } as const;
}
