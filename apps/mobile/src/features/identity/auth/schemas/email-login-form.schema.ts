import { loginSchema } from '@aido/api';

export const emailLoginFormSchema = loginSchema.pick({ email: true, password: true });
