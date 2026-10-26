import { userIdParamSchema, userReportTargetTypeSchema } from '@aido/api';
import { useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

import type { UserReportTarget } from '../domains/user-report.model';

/**
 * 사람을 기준으로 여는 신고 route의 대상. 폴더의 userId가 신고할 사람이고,
 * 쿼리는 그 사람의 무엇을 신고하는지(프로필·콕 메시지·응원 메시지)와 확인 문구에 쓸 이름이다.
 */
export const userReportRouteParamsSchema = userIdParamSchema
  .extend({
    name: z.string().trim().min(1),
    targetType: userReportTargetTypeSchema.extract(['PROFILE', 'NUDGE_MESSAGE', 'CHEER_MESSAGE']),
    targetId: z.string().trim().min(1).optional(),
  })
  .refine(({ targetType, targetId }) => (targetType === 'PROFILE') === (targetId == null));

export function useUserReportRouteParams(): { target: UserReportTarget; displayName: string } {
  const { userId, name, targetType, targetId } =
    userReportRouteParamsSchema.parse(useLocalSearchParams());
  return { target: { targetUserId: userId, targetType, targetId }, displayName: name };
}
