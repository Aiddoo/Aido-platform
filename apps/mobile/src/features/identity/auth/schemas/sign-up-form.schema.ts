import { registerSchema } from '@aido/api';
import { z } from 'zod';

const { email, password, passwordConfirm, name } = registerSchema.shape;

export const signUpFormSchema = z
  .object({
    email,
    password,
    passwordConfirm,
    name: name.unwrap(),
    termsAgreed: z.boolean(),
    privacyAgreed: z.boolean(),
    marketingAgreed: z.boolean(),
    marketingPushAgreed: z.boolean(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    path: ['passwordConfirm'],
  });

export type SignUpFormValues = z.input<typeof signUpFormSchema>;
