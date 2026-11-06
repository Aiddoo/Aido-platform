import { registerSchema } from '@aido/api';
import { z } from 'zod';

const { email, password, passwordConfirm, name } = registerSchema.shape;

/** 회원가입 폼. 서버 계약과 달리 닉네임은 필수이고, 약관 동의는 체크 전 false를 허용한다. */
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

export type SignUpFormInput = z.input<typeof signUpFormSchema>;
export type SignUpFormOutput = z.output<typeof signUpFormSchema>;
