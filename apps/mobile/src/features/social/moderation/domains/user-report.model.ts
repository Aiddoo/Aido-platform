import { USER_REPORT_TARGET_TYPES } from '@aido/api/vocabulary';
import { z } from 'zod';

// 시트를 연 화면이 대상을 정하고 시트는 사유와 상세만 받는다. 대상은 route의 id로 만들어 Policy 밖 함수로 둔다
const userReportTargetSchema = z.object({
  targetUserId: z.string(),
  targetType: z.enum(USER_REPORT_TARGET_TYPES),
  targetId: z.string().optional(),
});
export type UserReportTarget = z.infer<typeof userReportTargetSchema>;

export function createTodoReportTarget({
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

export function createProfileReportTarget({ userId }: { userId: string }): UserReportTarget {
  return { targetUserId: userId, targetType: 'PROFILE' };
}

export function createNudgeMessageReportTarget({
  nudgeId,
  senderId,
}: {
  nudgeId: number;
  senderId: string;
}): UserReportTarget {
  return { targetUserId: senderId, targetType: 'NUDGE_MESSAGE', targetId: String(nudgeId) };
}

export function createCheerMessageReportTarget({
  cheerId,
  senderId,
}: {
  cheerId: number;
  senderId: string;
}): UserReportTarget {
  return { targetUserId: senderId, targetType: 'CHEER_MESSAGE', targetId: String(cheerId) };
}
