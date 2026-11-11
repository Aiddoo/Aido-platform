import { z } from 'zod';

export const activationProgressStorageSchema = z.object({
  todoCreatedAt: z.iso.datetime().nullable(),
  activatedAt: z.iso.datetime().nullable(),
});
export type ActivationProgressStorage = z.infer<typeof activationProgressStorageSchema>;
