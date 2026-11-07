import { zodResolver } from '@hookform/resolvers/zod';
import { EmailVerificationCodeStep } from '@src/features/identity/auth/components/email-verification-code-step';
import { NewPasswordStep } from '@src/features/identity/auth/components/new-password-step';
import { SuggestedEmailDomainList } from '@src/features/identity/auth/components/suggested-email-domain-list';
import {
  useForgotPasswordMutationOptions,
  useResetPasswordMutationOptions,
} from '@src/features/identity/auth/queries/auth.mutations';
import {
  type ForgotPasswordFormInput,
  forgotPasswordFormSchema,
} from '@src/features/identity/auth/schemas/forgot-password-form.schema';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { useReportUnexpectedError } from '@src/shared/hooks/use-report-unexpected-error';
import { useStepper } from '@src/shared/hooks/use-stepper';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import {
  Input,
  KeyboardAdaptiveButton,
  ReadableContent,
  VStack,
  FormStepLayout,
  Box,
} from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import {
  useFormState,
  FormProvider,
  useForm,
  useFormContext,
  useWatch,
  Controller,
} from 'react-hook-form';
import Animated, { FadeIn } from 'react-native-reanimated';

type ForgotPasswordStepContexts = {
  email: Record<string, never>;
  verificationCode: { email: string };
  newPassword: Record<string, never>;
};

export default function ForgotPasswordScreen() {
  const form = useForm({
    resolver: zodResolver(forgotPasswordFormSchema),
    defaultValues: {
      email: '',
      code: '',
      newPassword: '',
      newPasswordConfirm: '',
    },
    mode: 'onChange',
  });
  const stepper = useStepper<ForgotPasswordStepContexts>({
    id: 'forgot-password',
    initial: { step: 'email', context: {} },
  });
  const reportUnexpectedError = useReportUnexpectedError('auth');
  const forgotPassword = useMutation(useForgotPasswordMutationOptions());
  const resetPassword = useMutation(useResetPasswordMutationOptions());
  const { t } = useTranslation('auth');

  const requestCode = async () => {
    try {
      const email = form.getValues('email');
      await forgotPassword.mutateAsync({ email });
      stepper.history.push('verificationCode', { email });
    } catch (error) {
      reportUnexpectedError(error);
    }
  };

  const submitNewPassword = form.handleSubmit(async (input) => {
    try {
      await resetPassword.mutateAsync(input);
    } catch (error) {
      reportUnexpectedError(error);
    }
  });

  return (
    <Box className="flex-1 bg-white">
      <ReadableContent flex={1}>
        <FormProvider {...form}>
          {stepper.Render({
            email: () => (
              <EmailStep onSubmit={requestCode} isSubmitting={forgotPassword.isPending} />
            ),
            verificationCode: ({ context: { email }, history }) => (
              <EmailVerificationCodeStep
                email={email}
                onComplete={async (code) => {
                  form.setValue('code', code, { shouldValidate: true });
                  history.push('newPassword', {});
                }}
                onResend={async () => {
                  await forgotPassword.mutateAsync({ email });
                  return {};
                }}
              />
            ),
            newPassword: () => (
              <NewPasswordStep
                onSubmit={submitNewPassword}
                nextLabel={t('forgotPassword.next')}
                submitLabel={t('forgotPassword.submit')}
              />
            ),
          })}
        </FormProvider>
      </ReadableContent>
    </Box>
  );
}

interface EmailStepProps {
  onSubmit: () => Promise<unknown>;
  isSubmitting: boolean;
}

function EmailStep({ onSubmit, isSubmitting }: EmailStepProps) {
  const { t } = useTranslation('auth');
  const { control } = useFormContext<ForgotPasswordFormInput>();
  const { errors } = useFormState({ control, name: 'email' });
  const email = useWatch({ control, name: 'email' });
  const isValid = email.length > 0 && !errors.email;

  return (
    <Box className="flex-1">
      <FormStepLayout title={t('forgotPassword.emailTitle')}>
        <Animated.View entering={FadeIn.duration(ANIMATION.duration.normal)}>
          <VStack gap={8}>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
                <VStack gap={8}>
                  <Input
                    placeholder={t('forgotPassword.emailPlaceholder')}
                    value={value}
                    onChange={onChange}
                    onBlur={onBlur}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    returnKeyType="done"
                    submitBehavior="submit"
                    isInvalid={!!error}
                    errorMessage={resolveValidationMessage(error, {
                      default: 'email.invalid',
                      byType: { too_big: 'email.tooLong' },
                    })}
                    onSubmitEditing={() => {
                      if (isValid) {
                        onSubmit();
                      }
                    }}
                  />
                  <SuggestedEmailDomainList value={value} onChange={onChange} />
                </VStack>
              )}
            />
          </VStack>
        </Animated.View>
      </FormStepLayout>

      <KeyboardAdaptiveButton onPress={onSubmit} isDisabled={!isValid} isLoading={isSubmitting}>
        {t('forgotPassword.next')}
      </KeyboardAdaptiveButton>
    </Box>
  );
}
