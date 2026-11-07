import ConfirmationNumber from '@expo/material-symbols/confirmation_number.xml';
import { zodResolver } from '@hookform/resolvers/zod';
import { EmailVerificationCodeStep } from '@src/features/identity/auth/components/email-verification-code-step';
import { SignUpPasswordForm } from '@src/features/identity/auth/components/sign-up-password-form';
import { SignUpUserInfoForm } from '@src/features/identity/auth/components/sign-up-user-info-form';
import {
  useRegisterMutationOptions,
  useResendVerificationMutationOptions,
  useVerifyEmailMutationOptions,
} from '@src/features/identity/auth/queries/auth.mutations';
import { signUpFormSchema } from '@src/features/identity/auth/schemas/sign-up-form.schema';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useStepper } from '@src/shared/hooks/use-stepper';
import { useTranslation } from '@src/shared/i18n';
import { ReadableContent, Box } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { FormProvider, useForm } from 'react-hook-form';

/** iOS는 글자 버튼, Android 툴바는 글자를 그리지 않아 아이콘을 쓴다 */
const INVITE_CODE_ICON = process.env.EXPO_OS === 'ios' ? undefined : ConfirmationNumber;

type SignUpStepContexts = {
  userInfo: Record<string, never>;
  password: Record<string, never>;
  verification: { email: string };
};

const SIGN_UP_STEP_TITLE_KEYS = {
  userInfo: 'auth:signUp.title',
  password: 'auth:signUp.passwordStepTitle',
  verification: 'auth:signUp.verificationStepTitle',
} as const satisfies Record<keyof SignUpStepContexts, string>;

export default function SignUpScreen() {
  const { t } = useTranslation(['auth', 'invite']);
  const stepper = useStepper<SignUpStepContexts>({
    id: 'sign-up',
    initial: { step: 'userInfo', context: {} },
  });

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
  const openInviteCodeEntry = useSingleTap(() => router.push('/invite'));

  const submitRegister = form.handleSubmit(async ({ termsAgreed, privacyAgreed, ...input }) => {
    if (!termsAgreed || !privacyAgreed) {
      return;
    }

    try {
      await register.mutateAsync({ ...input, termsAgreed, privacyAgreed });
      stepper.history.replace('verification', { email: input.email });
    } catch (error) {
      reportUnexpectedError(error);
    }
  });

  return (
    <Box className="flex-1 bg-white">
      <Stack.Screen options={{ title: t(SIGN_UP_STEP_TITLE_KEYS[stepper.step]) }} />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          hidden={stepper.step !== 'userInfo'}
          icon={INVITE_CODE_ICON}
          accessibilityLabel={t('invite:entry.haveInviteCode')}
          onPress={openInviteCodeEntry}
        >
          {t('invite:entry.inviteCodeShort')}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      <ReadableContent flex={1}>
        {stepper.Render({
          userInfo: ({ history }) => (
            <FormProvider {...form}>
              <SignUpUserInfoForm onNextStep={() => history.push('password', {})} />
            </FormProvider>
          ),
          password: () => (
            <FormProvider {...form}>
              <SignUpPasswordForm onSubmit={submitRegister} />
            </FormProvider>
          ),
          verification: ({ context: { email } }) => (
            <EmailVerificationCodeStep
              email={email}
              onComplete={(code) => verify.mutateAsync({ email, code })}
              onResend={() => resend.mutateAsync({ email })}
            />
          ),
        })}
      </ReadableContent>
    </Box>
  );
}
