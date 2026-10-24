import { zodResolver } from '@hookform/resolvers/zod';
import { EmailVerificationCodeStep } from '@src/features/auth/components/email-verification-code-step';
import { SignUpPasswordForm } from '@src/features/auth/components/sign-up-password-form';
import { SignUpUserInfoForm } from '@src/features/auth/components/sign-up-user-info-form';
import { signUpFormSchema } from '@src/features/auth/domains/sign-up-form.schema';
import { useResendVerificationMutationOptions } from '@src/features/auth/queries/use-resend-verification-mutation-options';
import { useVerifyEmailMutationOptions } from '@src/features/auth/queries/use-verify-email-mutation-options';
import { useStepper } from '@src/shared/hooks/use-stepper';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, ReadableContent } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { FormProvider, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { match } from 'ts-pattern';

const SIGN_UP_STEPS = ['userInfo', 'password', 'verification'] as const;
type SignUpStep = (typeof SIGN_UP_STEPS)[number];

const SIGN_UP_STEP_TITLE_KEYS = {
  userInfo: 'auth:signUp.title',
  password: 'auth:signUp.passwordStepTitle',
  verification: 'auth:signUp.verificationStepTitle',
} as const satisfies Record<SignUpStep, string>;

function SignUpScreen() {
  const { t } = useTranslation(['auth']);
  const { step, setStep } = useStepper<typeof SIGN_UP_STEPS>(SIGN_UP_STEPS);

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

  const verify = useMutation(useVerifyEmailMutationOptions());
  const resend = useMutation(useResendVerificationMutationOptions());

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: t(SIGN_UP_STEP_TITLE_KEYS[step]) }} />

      <ReadableContent flex={1}>
        {match(step)
          .with('userInfo', () => (
            <FormProvider {...form}>
              <SignUpUserInfoForm onNextStep={() => setStep('password')} />
            </FormProvider>
          ))
          .with('password', () => (
            <FormProvider {...form}>
              <SignUpPasswordForm onNextStep={() => setStep('verification')} />
            </FormProvider>
          ))
          .with('verification', () => {
            const email = form.getValues('email');
            return (
              <EmailVerificationCodeStep
                email={email}
                onComplete={(code) => verify.mutateAsync({ email, code })}
                onResend={() => resend.mutateAsync({ email })}
              />
            );
          })
          .exhaustive()}
      </ReadableContent>
    </View>
  );
}

/** 제출 중 예측하지 못한 오류(showBoundary)를 이 화면 안에서 받아 다시 시도하게 한다. */
export default function SignUpRoute() {
  return (
    <QueryErrorBoundary>
      <SignUpScreen />
    </QueryErrorBoundary>
  );
}
