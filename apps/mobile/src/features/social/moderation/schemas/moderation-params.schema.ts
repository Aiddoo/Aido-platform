import { userIdParamSchema } from '@aido/api/contracts/follow/v1';
import { todoCommentIdSchema } from '@aido/api/contracts/todo-comment/v1';
import { userReportTargetTypeSchema } from '@aido/api/contracts/user-report/v1';
import { todoParamsSchema } from '@src/features/planning/todo/schemas/todo-params.schema';
import { z } from 'zod';

export const blockUserParamsSchema = userIdParamSchema.extend({
  name: z.string().trim().min(1),
});

export const commentReportParamsSchema = todoParamsSchema.extend({
  commentId: todoCommentIdSchema,
});

/** 폴더의 userId가 신고할 사람이고, 쿼리는 그 사람의 무엇을 신고하는지와 확인 문구에 쓸 이름이다 */
export const userReportParamsSchema = userIdParamSchema
  .extend({
    name: z.string().trim().min(1),
    targetType: userReportTargetTypeSchema.extract(['PROFILE', 'NUDGE_MESSAGE', 'CHEER_MESSAGE']),
    targetId: z.string().trim().min(1).optional(),
  })
  .refine(({ targetType, targetId }) => (targetType === 'PROFILE') === (targetId == null));
