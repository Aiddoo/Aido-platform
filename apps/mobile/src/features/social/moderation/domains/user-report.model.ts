import type {
  UserReportFormInput,
  UserReportRequest,
  UserReportTarget,
} from '../schemas/user-report.schema';

function createTodoReportTarget({
  todoId,
  ownerId,
}: {
  todoId: number;
  ownerId: string;
}): UserReportTarget {
  return { targetUserId: ownerId, targetType: 'TODO', targetId: String(todoId) };
}

export function createCommentReportTarget({
  commentId,
  authorId,
}: {
  commentId: string;
  authorId: string;
}): UserReportTarget {
  return { targetUserId: authorId, targetType: 'COMMENT', targetId: commentId };
}

function createProfileReportTarget({ userId }: { userId: string }): UserReportTarget {
  return { targetUserId: userId, targetType: 'PROFILE' };
}

function createNudgeMessageReportTarget({
  nudgeId,
  senderId,
}: {
  nudgeId: number;
  senderId: string;
}): UserReportTarget {
  return { targetUserId: senderId, targetType: 'NUDGE_MESSAGE', targetId: String(nudgeId) };
}

function createCheerMessageReportTarget({
  cheerId,
  senderId,
}: {
  cheerId: number;
  senderId: string;
}): UserReportTarget {
  return { targetUserId: senderId, targetType: 'CHEER_MESSAGE', targetId: String(cheerId) };
}

/** 공백만 적은 상세 내용은 보내지 않아 서버가 상세 없이 접수한다 */
export function createUserReportRequest(
  target: UserReportTarget,
  form: UserReportFormInput,
): UserReportRequest {
  const detail = form.detail?.trim();

  return {
    ...target,
    reason: form.reason,
    detail: detail == null || detail.length === 0 ? undefined : detail,
  };
}

export const UserReportPolicy = {
  createTodoReportTarget,
  createCommentReportTarget,
  createProfileReportTarget,
  createNudgeMessageReportTarget,
  createCheerMessageReportTarget,
  createUserReportRequest,
} as const;
