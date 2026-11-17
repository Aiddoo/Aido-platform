import { loginSchema } from '@aido/api/contracts/auth/v1';

export const emailLoginFormSchema = loginSchema.pick({ email: true, password: true });
