import { updateProfileSchema } from '@aido/api';
import { z } from 'zod';

export const updateNameFormSchema = z.object({
  name: updateProfileSchema.shape.name.unwrap(),
});
export type UpdateNameFormInput = z.infer<typeof updateNameFormSchema>;
