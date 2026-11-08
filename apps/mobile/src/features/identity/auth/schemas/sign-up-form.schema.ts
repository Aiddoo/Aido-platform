import { registerSchema } from '@aido/api';
import { z } from 'zod';

const { email, password, passwordConfirm, name } = registerSchema.shape;

/** 서버 계약과 달리 닉네임은 필수다. 약관은 체크 전 false로 시작하고 필수 두 개가 켜져야 제출된다 */
export const signUpFormSchema = z
  .object({
    email,
    password,
    passwordConfirm,
    name: name.unwrap(),
    termsAgreed: z.boolean(),
    privacyAgreed: z.boolean(),
    /** 혜택·소식(앱 푸시·이메일) 한 묶음. 보낼 때 마케팅·광고성 푸시 동의 둘로 나눈다 */
    isMarketingAgreed: z.boolean(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    path: ['passwordConfirm'],
  })
  .refine((data) => data.termsAgreed && data.privacyAgreed, {
    path: ['termsAgreed'],
  });

export type SignUpFormValues = z.input<typeof signUpFormSchema>;
