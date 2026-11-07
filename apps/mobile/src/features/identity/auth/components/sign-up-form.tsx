import { zodResolver } from '@hookform/resolvers/zod';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { type Stepper } from '@src/shared/hooks/use-stepper';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';

import {
  useRegisterMutationOptions,
  useResendVerificationMutationOptions,
  useVerifyEmailMutationOptions,
} from '../queries/auth.mutations';
import { signUpFormSchema } from '../schemas/sign-up-form.schema';
import { EmailVerificationCodeStep } from './email-verification-code-step';
import { SignUpPasswordForm } from './sign-up-password-form';
import { SignUpUserInfoForm } from './sign-up-user-info-form';

export type SignUpStepContexts = {
  userInfo: Record<string, never>;
  password: Record<string, never>;
  verification: { email: string };
};

interface SignUpFormProps {
  /** 제목과 툴바가 단계를 따라가므로 단계 이동은 화면이 소유하고 여기서는 읽고 옮기기만 한다 */
  stepper: Stepper<SignUpStepContexts>;
}

/** 가입 3단계(정보, 비밀번호, 이메일 인증)의 입력과 제출. 앞 단계로 돌아가도 입력값은 폼이 지킨다 */
export function SignUpForm({ stepper }: SignUpFormProps) {
  const form = useForm({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: {
      email: '',
      termsAgreed: false,
      privacyAgreed: false,
      marketingAgreed: false,
      marketingPushAgreed: false,
      password: '',
      passwordConfirm: '',
      name: '',
    },
    mode: 'onTouched',
  });
  const reportUnexpectedError = useReportUnexpectedError('auth');
  const register = useMutation(useRegisterMutationOptions());
  const verify = useMutation(useVerifyEmailMutationOptions());
  const resend = useMutation(useResendVerificationMutationOptions());

  const submitValidRegister = form.handleSubmit(
    async ({ termsAgreed, privacyAgreed, ...input }) => {
      if (!termsAgreed || !privacyAgreed) {
        return;
      }

      try {
        await register.mutateAsync({ ...input, termsAgreed, privacyAgreed });
        stepper.history.replace('verification', { email: input.email });
      } catch (error) {
        reportUnexpectedError(error);
      }
    },
  );

  const submitRegister = async () => {
    const isUserInfoValid = await form.trigger(['name', 'email']);
    if (!isUserInfoValid) {
      stepper.history.go(-stepper.index);
      return false;
    }
    const isPasswordValid = await form.trigger(['password', 'passwordConfirm'], {
      shouldFocus: true,
    });
    if (!isPasswordValid) {
      return false;
    }

    await submitValidRegister();
    return true;
  };

  return stepper.Render({
    userInfo: ({ history }) => (
      <SignUpUserInfoForm form={form} onNextStep={() => history.push('password', {})} />
    ),
    password: () => <SignUpPasswordForm form={form} onSubmit={submitRegister} />,
    verification: ({ context: { email } }) => (
      <EmailVerificationCodeStep
        email={email}
        isVerifying={verify.isPending}
        isResending={resend.isPending}
        onComplete={(code) => verify.mutateAsync({ email, code })}
        onResend={() => resend.mutateAsync({ email })}
      />
    ),
  });
}
