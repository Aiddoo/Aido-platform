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
  stepper: Stepper<SignUpStepContexts>;
}

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

  // 실패하면 false를 돌려 약관 시트를 열어 둔다
  const submitValidRegister = () =>
    new Promise<boolean>((resolve) => {
      form.handleSubmit(
        async ({ termsAgreed, privacyAgreed, ...input }) => {
          if (!termsAgreed || !privacyAgreed) {
            resolve(false);
            return;
          }

          try {
            await register.mutateAsync({ ...input, termsAgreed, privacyAgreed });
            stepper.history.replace('verification', { email: input.email });
            resolve(true);
          } catch (error) {
            reportUnexpectedError(error);
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
