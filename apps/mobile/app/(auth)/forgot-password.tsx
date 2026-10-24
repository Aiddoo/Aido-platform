import { zodResolver } from '@hookform/resolvers/zod';
import { EmailVerificationCodeStep } from '@src/features/auth/components/email-verification-code-step';
import { NewPasswordStep } from '@src/features/auth/components/new-password-step';
import { SuggestedEmailDomainList } from '@src/features/auth/components/suggested-email-domain-list';
import {
  type ForgotPasswordFormInput,
  forgotPasswordFormSchema,
} from '@src/features/auth/domains/forgot-password-form.schema';
import { useForgotPasswordMutationOptions } from '@src/features/auth/queries/use-forgot-password-mutation-options';
import { useResetPasswordMutationOptions } from '@src/features/auth/queries/use-reset-password-mutation-options';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { isBusinessError } from '@src/shared/errors/result';
import { useStepper } from '@src/shared/hooks/use-stepper';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import {
  H3,
  Input,
  KeyboardAdaptiveButton,
  ReadableContent,
  VStack,
  QueryErrorBoundary,
  StyledSafeAreaView,
} from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { useMutation } from '@tanstack/react-query';
import { useErrorBoundary } from 'react-error-boundary';
import { useFormState, FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { match } from 'ts-pattern';

const STEPS = ['email', 'verificationCode', 'newPassword'] as const;

function ForgotPasswordScreen() {
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
  const { step, setStep } = useStepper(STEPS);
  const { showBoundary } = useErrorBoundary();
  const forgotPassword = useMutation(useForgotPasswordMutationOptions());
  const resetPassword = useMutation(useResetPasswordMutationOptions());
  const { t } = useTranslation('auth');

  const requestCode = async () => {
    try {
      await forgotPassword.mutateAsync({ email: form.getValues('email') });
      setStep('verificationCode');
    } catch (error) {
      if (!isBusinessError(error)) {
        showBoundary(error);
      }
    }
  };

  const submitNewPassword = form.handleSubmit(async (input) => {
    try {
      await resetPassword.mutateAsync(input);
    } catch (error) {
      if (!isBusinessError(error)) {
        showBoundary(error);
      }
    }
  });

  return (
    <View className="flex-1 bg-background">
      <ReadableContent flex={1}>
        <FormProvider {...form}>
          {match(step)
            .with('email', () => (
              <EmailStep onSubmit={requestCode} isSubmitting={forgotPassword.isPending} />
            ))
            .with('verificationCode', () => (
              <EmailVerificationCodeStep
                email={form.getValues('email')}
                onComplete={async (code) => {
                  form.setValue('code', code, { shouldValidate: true });
                  setStep('newPassword');
                }}
                onResend={async () => {
                  await forgotPassword.mutateAsync({ email: form.getValues('email') });
                  return {};
                }}
              />
            ))
            .with('newPassword', () => (
              <NewPasswordStep
                onSubmit={submitNewPassword}
                nextLabel={t('forgotPassword.next')}
                submitLabel={t('forgotPassword.submit')}
              />
            ))
            .exhaustive()}
        </FormProvider>
      </ReadableContent>
    </View>
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
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <StyledSafeAreaView edges={['left', 'right']}>
          <Animated.View
            entering={FadeIn.duration(ANIMATION.duration.slow)}
            style={{ marginBottom: 24 }}
          >
            <H3>{t('forgotPassword.emailTitle')}</H3>
          </Animated.View>

          <Animated.View entering={FadeIn.duration(ANIMATION.duration.normal)}>
            <VStack gap={8}>
              <FormField control={control} name="email">
                {({ onChange, onBlur, value }, { error }) => (
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
              </FormField>
            </VStack>
          </Animated.View>
        </StyledSafeAreaView>
      </ScrollView>

      <KeyboardAdaptiveButton onPress={onSubmit} isDisabled={!isValid} isLoading={isSubmitting}>
        {t('forgotPassword.next')}
      </KeyboardAdaptiveButton>
    </View>
  );
}

/** 제출 중 예측하지 못한 오류(showBoundary)를 이 화면 안에서 받아 다시 시도하게 한다. */
export default function ForgotPasswordRoute() {
  return (
    <QueryErrorBoundary>
      <ForgotPasswordScreen />
    </QueryErrorBoundary>
  );
}
