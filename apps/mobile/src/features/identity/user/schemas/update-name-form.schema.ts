import { updateProfileSchema } from '@aido/api';
import { z } from 'zod';

export const updateNameFormSchema = z.object({
  name: updateProfileSchema.shape.name.unwrap(),
});
