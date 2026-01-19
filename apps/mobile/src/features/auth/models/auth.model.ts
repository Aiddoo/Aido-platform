import { z } from 'zod';

export const AuthUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  profileImageUrl: z.string().optional(),
});

export type AuthUser = z.infer<typeof AuthUserSchema>;
