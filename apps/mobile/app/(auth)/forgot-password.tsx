import { VERIFICATION_CODE } from '@aido/api';
import { ErrorCode } from '@aido/api/errors';
import { zodResolver } from '@hookform/resolvers/zod';
import { NewPasswordStep } from '@src/features/auth/components/new-password-step';
import { SuggestedEmailDomainList } from '@src/features/auth/components/suggested-email-domain-list';
import { VerificationCodeInput } from '@src/features/auth/components/verification-code-input';
import {
  type ForgotPasswordFormInput,
  forgotPasswordFormSchema,
} from '@src/features/auth/domains/forgot-password-form.schema';
import { useCooldown } from '@src/features/auth/hooks/use-cooldown';
import { useForgotPasswordMutationOptions } from '@src/features/auth/queries/use-forgot-password-mutation-options';
import { useResetPasswordMutationOptions } from '@src/features/auth/queries/use-reset-password-mutation-options';
import { maskEmail } from '@src/features/auth/utils/mask-email';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { isApiError } from '@src/shared/errors';
import { isBusinessError } from '@src/shared/errors/result';
import { useStepper } from '@src/shared/hooks/use-stepper';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import {
  H3,
  HStack,
  Input,
  KeyboardAdaptiveButton,
  ReadableContent,
  Text,
  TextButton,
  VStack,
  QueryErrorBoundary,
  StyledSafeAreaView,
} from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { useMutation } from '@tanstack/react-query';
import { type InputOTPRef } from 'heroui-native';
import { useRef } from 'react';
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
  const resetPassword = useMutation(useResetPasswordMutationOptions());
  const { t } = useTranslation('auth');

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
            .with('email', () => <EmailStep onNext={() => setStep('verificationCode')} />)
            .with('verificationCode', () => (
              <VerificationCodeStep onNext={() => setStep('newPassword')} />
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
  onNext: () => void;
}

function EmailStep({ onNext }: EmailStepProps) {
  const { t } = useTranslation('auth');
  const { control, getValues } = useFormContext<ForgotPasswordFormInput>();
  const { errors } = useFormState({ control, name: 'email' });
  const email = useWatch({ control, name: 'email' });
  const isValid = email.length > 0 && !errors.email;

  const forgotPasswordMutation = useMutation(useForgotPasswordMutationOptions());

  const handleNext = async () => {
    const emailValue = getValues('email');
    forgotPasswordMutation.mutate(
      {
        email: emailValue,
      },
      {
        onSuccess: () => onNext(),
      },
    );
  };

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
                          handleNext();
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

      <KeyboardAdaptiveButton
        onPress={handleNext}
        isDisabled={!isValid}
        isLoading={forgotPasswordMutation.isPending}
      >
        {t('forgotPassword.next')}
      </KeyboardAdaptiveButton>
    </View>
  );
}

interface VerificationCodeStepProps {
  onNext: () => void;
}

function VerificationCodeStep({ onNext }: VerificationCodeStepProps) {
  const { t } = useTranslation('auth');
  const { control, getValues, setValue } = useFormContext<ForgotPasswordFormInput>();
  const email = getValues('email');
  const maskedEmail = maskEmail(email);

  const inputOTPRef = useRef<InputOTPRef>(null);
  const [cooldown, setCooldown] = useCooldown(0);

  const forgotPasswordMutation = useMutation(useForgotPasswordMutationOptions());

  const handleComplete = (completedCode: string) => {
    setValue('code', completedCode, { shouldValidate: true });
    onNext();
  };

  const handleResend = () => {
    if (cooldown > 0) {
      return;
    }

    forgotPasswordMutation.mutate(
      { email },
      {
        onSuccess: () => {
          setCooldown(VERIFICATION_CODE.RESEND_COOLDOWN_SECONDS);
          setValue('code', '');
          inputOTPRef.current?.clear();
        },
        onError: (error) => {
          if (isApiError(error) && error.hasCode(ErrorCode.VERIFY_0753)) {
            const remaining = error.details?.remainingSeconds;
            if (typeof remaining === 'number') {
              setCooldown(remaining);
            }
          }
        },
      },
    );
  };

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
            <H3>{t('verification.codeSentTo', { email: maskedEmail })}</H3>
          </Animated.View>

          <VStack gap={32} align="center">
            <FormField control={control} name="code">
              {({ value, onChange }) => (
                <VerificationCodeInput
                  ref={inputOTPRef}
                  value={value}
                  onChange={onChange}
                  onComplete={handleComplete}
                />
              )}
            </FormField>

            <HStack gap={8} justify="center">
              <Text size="b4" shade={7}>
                {t('verification.didNotReceive')}
              </Text>
              <TextButton
                size="medium"
                onPress={handleResend}
                isDisabled={cooldown > 0 || forgotPasswordMutation.isPending}
              >
                {cooldown > 0
                  ? t('verification.resendIn', { count: cooldown })
                  : t('verification.resend')}
              </TextButton>
            </HStack>
          </VStack>
        </StyledSafeAreaView>
      </ScrollView>
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
