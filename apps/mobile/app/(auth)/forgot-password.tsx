import { ErrorCode } from '@aido/errors';
import { VERIFICATION_CODE } from '@aido/validators';
import { zodResolver } from '@hookform/resolvers/zod';
import { PasswordInput } from '@src/features/auth/presentations/components/PasswordInput';
import { PasswordStrengthIndicator } from '@src/features/auth/presentations/components/PasswordStrengthIndicator';
import { SuggestedEmailDomainList } from '@src/features/auth/presentations/components/SuggestedEmailDomainList';
import { useCooldown } from '@src/features/auth/presentations/hooks/use-cooldown';
import { useForgotPasswordMutationOptions } from '@src/features/auth/presentations/queries/use-forgot-password-mutation-options';
import { useResetPasswordMutationOptions } from '@src/features/auth/presentations/queries/use-reset-password-mutation-options';
import {
  type ForgotPasswordFormData,
  forgotPasswordFormSchema,
} from '@src/features/auth/presentations/schemas/forgot-password-form.schema';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { isApiError } from '@src/shared/errors';
import { isBusinessError } from '@src/shared/errors/result';
import { useStepper } from '@src/shared/hooks/useStepper';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import {
  H3,
  HStack,
  Input,
  KeyboardAdaptiveButton,
  Text,
  TextButton,
  VStack,
} from '@src/shared/ui';
import { FormField } from '@src/shared/ui/FormField/FormField';
import { useMutation } from '@tanstack/react-query';
import { InputOTP, type InputOTPRef } from 'heroui-native';
import type { ComponentRef } from 'react';
import { useCallback, useRef, useState } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { useFormState } from 'react-hook-form';
import { FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';
import type { TextInput } from 'react-native';
import { Keyboard, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { match } from 'ts-pattern';

const STEPS = ['email', 'verificationCode', 'newPassword'] as const;

const ForgotPasswordScreen = () => {
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

  return (
    <View className="flex-1 bg-background">
      <FormProvider {...form}>
        {match(step)
          .with('email', () => <EmailStep onNext={() => setStep('verificationCode')} />)
          .with('verificationCode', () => (
            <VerificationCodeStep onNext={() => setStep('newPassword')} />
          ))
          .with('newPassword', () => <NewPasswordStep />)
          .exhaustive()}
      </FormProvider>
    </View>
  );
};

export default ForgotPasswordScreen;

interface EmailStepProps {
  onNext: () => void;
}

function EmailStep({ onNext }: EmailStepProps) {
  const { t } = useTranslation('auth');
  const {
    control,

    getValues,
  } = useFormContext<ForgotPasswordFormData>();
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
                    if (isValid) handleNext();
                  }}
                />
              )}
            </FormField>
            <SuggestedEmailDomainList<ForgotPasswordFormData> name="email" />
          </VStack>
        </Animated.View>
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
  const { getValues, setValue } = useFormContext<ForgotPasswordFormData>();
  const email = getValues('email');
  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1****$3');

  const inputOTPRef = useRef<InputOTPRef>(null);
  const [cooldown, setCooldown] = useCooldown(0);
  const [code, setCode] = useState('');

  const forgotPasswordMutation = useMutation(useForgotPasswordMutationOptions());

  const handleComplete = (completedCode: string) => {
    setValue('code', completedCode, { shouldValidate: true });
    onNext();
  };

  const handleResend = () => {
    if (cooldown > 0) return;

    forgotPasswordMutation.mutate(
      { email },
      {
        onSuccess: () => {
          setCooldown(VERIFICATION_CODE.RESEND_COOLDOWN_SECONDS);
          setCode('');
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
        <Animated.View
          entering={FadeIn.duration(ANIMATION.duration.slow)}
          style={{ marginBottom: 24 }}
        >
          <H3>{t('verification.codeSentTo', { email: maskedEmail })}</H3>
        </Animated.View>

        <VStack gap={32} align="center">
          <InputOTP
            ref={inputOTPRef}
            maxLength={VERIFICATION_CODE.LENGTH}
            value={code}
            onChange={setCode}
            onComplete={handleComplete}
          >
            <InputOTP.Group>
              <InputOTP.Slot index={0} />
              <InputOTP.Slot index={1} />
              <InputOTP.Slot index={2} />
              <InputOTP.Slot index={3} />
              <InputOTP.Slot index={4} />
              <InputOTP.Slot index={5} />
            </InputOTP.Group>
          </InputOTP>

          <HStack gap={8} justify="center">
            <Text size="b4" shade={7}>
              {t('verification.didNotReceive')}
            </Text>
            <TextButton
              size="medium"
              onPress={handleResend}
              disabled={cooldown > 0 || forgotPasswordMutation.isPending}
            >
              {cooldown > 0
                ? t('verification.resendIn', { count: cooldown })
                : t('verification.resend')}
            </TextButton>
          </HStack>
        </VStack>
      </ScrollView>
    </View>
  );
}

const NEW_PASSWORD_SUB_STEPS = ['newPassword', 'newPasswordConfirm'] as const;

function NewPasswordStep() {
  const { showBoundary } = useErrorBoundary();

  const { t } = useTranslation('auth');
  const { step, setStep } = useStepper(NEW_PASSWORD_SUB_STEPS);
  const newPasswordConfirmInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const focusConfirmInput = useCallback(() => {
    newPasswordConfirmInputRef.current?.focus();
  }, []);

  const { control, handleSubmit } = useFormContext<ForgotPasswordFormData>();
  const { isSubmitting, errors } = useFormState({
    control,
    name: ['newPassword', 'newPasswordConfirm'],
  });

  const resetPasswordMutation = useMutation(useResetPasswordMutationOptions());

  const [newPassword, newPasswordConfirm] = useWatch({
    control,
    name: ['newPassword', 'newPasswordConfirm'],
  });

  const isNextEnabled = match(step)
    .with('newPassword', () => newPassword.length > 0 && !errors.newPassword)
    .with('newPasswordConfirm', () => newPasswordConfirm.length > 0 && !errors.newPasswordConfirm)
    .exhaustive();

  const handleNext = () => {
    match(step)
      .with('newPassword', () => setStep('newPasswordConfirm'))
      .with('newPasswordConfirm', () => {
        Keyboard.dismiss();
        handleSubmit(async (data) => {
          try {
            await resetPasswordMutation.mutateAsync(data);
          } catch (error) {
            if (!isBusinessError(error)) showBoundary(error);
          }
        })();
      })
      .exhaustive();
  };

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          key={step}
          entering={FadeIn.duration(ANIMATION.duration.slow)}
          style={{ marginBottom: 24 }}
        >
          <H3>{t('forgotPassword.newPasswordTitle')}</H3>
        </Animated.View>

        {step === 'newPasswordConfirm' && (
          <Animated.View
            entering={FadeInUp.duration(ANIMATION.duration.slow)
              .delay(ANIMATION.delay.short)
              .withCallback((finished) => {
                'worklet';
                if (finished) scheduleOnRN(focusConfirmInput);
              })}
          >
            <VStack mb={8}>
              <FormField control={control} name="newPasswordConfirm">
                {({ onChange, value }, { error }) => (
                  <PasswordInput
                    ref={newPasswordConfirmInputRef}
                    label={t('forgotPassword.newPasswordConfirmLabel')}
                    placeholder={t('forgotPassword.newPasswordConfirmPlaceholder')}
                    value={value}
                    onChange={onChange}
                    returnKeyType="done"
                    isInvalid={!!error}
                    errorMessage={error?.message}
                    onSubmitEditing={() => {
                      if (newPasswordConfirm.length > 0 && !error) handleNext();
                    }}
                  />
                )}
              </FormField>
            </VStack>
          </Animated.View>
        )}

        <Animated.View entering={FadeIn.duration(ANIMATION.duration.normal)}>
          <FormField control={control} name="newPassword">
            {({ onChange, value }, { error }) => (
              <VStack gap={4}>
                <PasswordInput
                  label={t('forgotPassword.newPasswordLabel')}
                  placeholder={t('forgotPassword.newPasswordPlaceholder')}
                  value={value}
                  onChange={onChange}
                  autoFocus={step === 'newPassword'}
                  submitBehavior="submit"
                  returnKeyType="next"
                  renderErrorMessage={false}
                  onSubmitEditing={() => {
                    if (newPassword.length > 0 && !error) handleNext();
                  }}
                />
                <PasswordStrengthIndicator password={newPassword} />
              </VStack>
            )}
          </FormField>
        </Animated.View>
      </ScrollView>

      <KeyboardAdaptiveButton
        onPress={handleNext}
        isDisabled={!isNextEnabled}
        isLoading={isSubmitting}
      >
        {step === 'newPasswordConfirm' ? t('forgotPassword.submit') : t('forgotPassword.next')}
      </KeyboardAdaptiveButton>
    </View>
  );
}
