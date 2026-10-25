import type { CreateUserReportInput, UserReportFormInput } from '@aido/api';

/** 신고할 대상. 시트를 연 화면이 정하고 시트는 사유와 상세만 받는다 */
export type UserReportTarget = Pick<
  CreateUserReportInput,
  'targetUserId' | 'targetType' | 'targetId'
>;

export function toTodoReportTarget({
  todoId,
  ownerId,
}: {
  todoId: number;
  ownerId: string;
}): UserReportTarget {
  return { targetUserId: ownerId, targetType: 'TODO', targetId: String(todoId) };
}

export function toCommentReportTarget({
  commentId,
  authorId,
}: {
  commentId: string;
  authorId: string;
}): UserReportTarget {
  return { targetUserId: authorId, targetType: 'COMMENT', targetId: commentId };
}

/** 공백만 적은 상세 내용은 보내지 않아 서버가 상세 없이 접수한다 */
export function toCreateUserReportInput(
  target: UserReportTarget,
  form: UserReportFormInput,
): CreateUserReportInput {
  const detail = form.detail?.trim();
  return {
    ...target,
    reason: form.reason,
    detail: detail == null || detail.length === 0 ? undefined : detail,
  };
}

export const UserReportPolicy = {
  todoTarget: toTodoReportTarget,
  commentTarget: toCommentReportTarget,
  toRequest: toCreateUserReportInput,
} as const;
