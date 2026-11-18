import { updateProfileSchema } from '@aido/api/contracts/auth/v1';
import { z } from 'zod';

export const updateNameFormSchema = z.object({
  name: updateProfileSchema.shape.name.unwrap(),
});
