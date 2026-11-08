import { z } from 'zod';

/** 기기 저장 형식. 키와 모양은 이미 설치된 앱의 값과 같아야 해서 바꾸지 않는다 */
export const activationProgressStorageSchema = z.object({
  todoCreatedAt: z.iso.datetime().nullable(),
  activatedAt: z.iso.datetime().nullable(),
  pushRegistrationUnlockedAt: z.iso.datetime().nullable().default(null),
});
export type ActivationProgressStorage = z.infer<typeof activationProgressStorageSchema>;
