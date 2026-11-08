import {
  type CreateUserReportInput,
  userReportFormSchema as userReportFormContractSchema,
  type userReportReasonSchema,
  type userReportTargetTypeSchema,
} from '@aido/api';
import type { z } from 'zod';

export const userReportFormSchema = userReportFormContractSchema;
export type UserReportFormValues = z.infer<typeof userReportFormSchema>;

export type UserReportRequest = CreateUserReportInput;

/** 신고할 대상. 시트를 연 화면이 정하고 시트는 사유와 상세만 받는다 */
export type UserReportTarget = Pick<UserReportRequest, 'targetUserId' | 'targetType' | 'targetId'>;
export type UserReportTargetType = z.infer<typeof userReportTargetTypeSchema>;
export type UserReportReason = z.infer<typeof userReportReasonSchema>;
