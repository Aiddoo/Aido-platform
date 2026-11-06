import { userSchema } from '@src/features/identity/user/domains/user.model';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

/** 이 기기에서 기록한 시작 체크리스트 진행. 디스크에는 ISO 문자열로 남아 그대로 순간으로 쓴다 */
export const activationProgressSchema = z.object({
  todoCreatedAt: instantSchema.nullable(),
  activatedAt: instantSchema.nullable(),
  pushRegistrationUnlockedAt: instantSchema.nullable(),
});
export type ActivationProgress = z.infer<typeof activationProgressSchema>;

export const activationIdentitySchema = z.object({ accountId: z.string(), campaignId: z.string() });
export type ActivationIdentity = z.infer<typeof activationIdentitySchema>;

export const activationUserSchema = userSchema.pick({ id: true, createdAt: true });
export type ActivationUser = z.infer<typeof activationUserSchema>;

export const activationChecklistStepsSchema = z.object({
  hasCreatedTodo: z.boolean(),
  hasCompletedTodo: z.boolean(),
});
export type ActivationChecklistSteps = z.infer<typeof activationChecklistStepsSchema>;
