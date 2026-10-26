import ConfirmationNumber from '@expo/material-symbols/confirmation_number.xml';
import { zodResolver } from '@hookform/resolvers/zod';
import { EmailVerificationCodeStep } from '@src/features/auth/components/email-verification-code-step';
import { SignUpPasswordForm } from '@src/features/auth/components/sign-up-password-form';
import { SignUpUserInfoForm } from '@src/features/auth/components/sign-up-user-info-form';
import { signUpFormSchema } from '@src/features/auth/domains/sign-up-form.schema';
import { useRegisterMutationOptions } from '@src/features/auth/queries/use-register-mutation-options';
import { useResendVerificationMutationOptions } from '@src/features/auth/queries/use-resend-verification-mutation-options';
import { useVerifyEmailMutationOptions } from '@src/features/auth/queries/use-verify-email-mutation-options';
import { inviteCodeEntryHref } from '@src/features/invite/utils/navigation/invite-href';
import { isBusinessError } from '@src/shared/errors/result';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, ReadableContent, Box } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { FormProvider, useForm } from 'react-hook-form';
import { match } from 'ts-pattern';

/** iOS는 글자 버튼, Android 툴바는 글자를 그리지 않아 아이콘을 쓴다 */
const INVITE_CODE_ICON = process.env.EXPO_OS === 'ios' ? undefined : ConfirmationNumber;

const SIGN_UP_STEPS = ['userInfo', 'password', 'verification'] as const;
type SignUpStep = (typeof SIGN_UP_STEPS)[number];

const SIGN_UP_STEP_TITLE_KEYS = {
  userInfo: 'auth:signUp.title',
  password: 'auth:signUp.passwordStepTitle',
  verification: 'auth:signUp.verificationStepTitle',
} as const satisfies Record<SignUpStep, string>;

function SignUpScreen() {
  const { t } = useTranslation(['auth', 'invite']);
  const [step, setStep] = useState<SignUpStep>('userInfo');

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

  const { showBoundary } = useErrorBoundary();
  const register = useMutation(useRegisterMutationOptions());
  const verify = useMutation(useVerifyEmailMutationOptions());
  const resend = useMutation(useResendVerificationMutationOptions());
  const openInviteCodeEntry = useSingleTap(() => router.push(inviteCodeEntryHref()));

  const submitRegister = form.handleSubmit(async ({ termsAgreed, privacyAgreed, ...input }) => {
    if (!termsAgreed || !privacyAgreed) {
      return;
    }

    try {
      await register.mutateAsync({ ...input, termsAgreed, privacyAgreed });
      setStep('verification');
    } catch (error) {
      if (!isBusinessError(error)) {
        showBoundary(error);
      }
    }
  });

  return (
    <Box className="flex-1 bg-background">
      <Stack.Screen options={{ title: t(SIGN_UP_STEP_TITLE_KEYS[step]) }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          hidden={step !== 'userInfo'}
          icon={INVITE_CODE_ICON}
          accessibilityLabel={t('invite:entry.haveInviteCode')}
          onPress={openInviteCodeEntry}
        >
          {t('invite:entry.inviteCodeShort')}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      <ReadableContent flex={1}>
        {match(step)
          .with('userInfo', () => (
            <FormProvider {...form}>
              <SignUpUserInfoForm onNextStep={() => setStep('password')} />
            </FormProvider>
          ))
          .with('password', () => (
            <FormProvider {...form}>
              <SignUpPasswordForm onSubmit={submitRegister} />
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
    </Box>
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
