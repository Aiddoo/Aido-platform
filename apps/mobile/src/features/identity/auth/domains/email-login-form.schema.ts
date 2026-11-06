import { loginSchema } from '@aido/api';
import type { z } from 'zod';

export const emailLoginFormSchema = loginSchema.pick({ email: true, password: true });

export type EmailLoginFormInput = z.input<typeof emailLoginFormSchema>;
