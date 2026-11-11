import { zodResolver } from '@hookform/resolvers/zod';
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

/** 앞 단계로 돌아가도 입력값은 폼이 지킨다 */
export function SignUpForm({ stepper }: SignUpFormProps) {
  const form = useForm({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: {
      email: '',
      termsAgreed: false,
      privacyAgreed: false,
      isMarketingAgreed: false,
      password: '',
      passwordConfirm: '',
      name: '',
    },
    mode: 'onTouched',
  });
  const register = useMutation(useRegisterMutationOptions());
  const verify = useMutation(useVerifyEmailMutationOptions());
  const resend = useMutation(useResendVerificationMutationOptions());

  // 가입 요청이 실패하면 false를 돌려 약관 시트를 열어 둔다. 바로 다시 누를 수 있다
  const submitValidRegister = () =>
    new Promise<boolean>((resolve) => {
      form.handleSubmit(
        async ({ termsAgreed, privacyAgreed, isMarketingAgreed, ...input }) => {
          // 스키마가 이미 막았다. 요청 타입이 true만 받아 여기서 좁힌다
          if (!termsAgreed || !privacyAgreed) {
            resolve(false);
            return;
          }

          try {
            await register.mutateAsync({
              ...input,
              termsAgreed,
              privacyAgreed,
              marketingAgreed: isMarketingAgreed,
              marketingPushAgreed: isMarketingAgreed,
            });
            stepper.history.replace('verification', { email: input.email });
            resolve(true);
          } catch {
            resolve(false);
          }
        },
        () => resolve(false),
      )();
    });

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

    return submitValidRegister();
  };

  return (
    <stepper.Render
      userInfo={({ history }) => (
        <SignUpUserInfoForm form={form} onNextStep={() => history.push('password', {})} />
      )}
      password={() => <SignUpPasswordForm form={form} onSubmit={submitRegister} />}
      verification={({ context: { email } }) => (
        <EmailVerificationCodeStep
          email={email}
          isVerifying={verify.isPending}
          isResending={resend.isPending}
          onComplete={(code) => verify.mutateAsync({ email, code })}
          onResend={() => resend.mutateAsync({ email })}
        />
      )}
    />
  );
}
