import { z } from 'zod';

/** 기기 저장 형식. 키는 이미 설치된 앱과 같다. 1.14.x가 남긴 `pushRegistrationUnlockedAt`은 읽지 않고 버린다 */
export const activationProgressStorageSchema = z.object({
  todoCreatedAt: z.iso.datetime().nullable(),
  activatedAt: z.iso.datetime().nullable(),
});
export type ActivationProgressStorage = z.infer<typeof activationProgressStorageSchema>;
