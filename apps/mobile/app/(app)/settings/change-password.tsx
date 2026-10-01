import { type ChangePasswordInput, changePasswordSchema } from '@aido/validators';
import { zodResolver } from '@hookform/resolvers/zod';
import { PasswordInput } from '@src/features/auth/presentations/components/PasswordInput';
import { PasswordStrengthIndicator } from '@src/features/auth/presentations/components/PasswordStrengthIndicator';
import { useChangePasswordMutationOptions } from '@src/features/auth/presentations/queries/use-change-password-mutation-options';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { isBusinessError } from '@src/shared/errors/result';
import { useStepper } from '@src/shared/hooks/useStepper';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import { H3, KeyboardAdaptiveButton, QueryErrorBoundary, VStack } from '@src/shared/ui';
import { FormField } from '@src/shared/ui/FormField/FormField';
import { useMutation } from '@tanstack/react-query';
import type { ComponentRef } from 'react';
import { Suspense, useCallback, useRef } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { useFormState } from 'react-hook-form';
import { FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';
import type { TextInput } from 'react-native';
import { Keyboard, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { match } from 'ts-pattern';

const STEPS = ['currentPassword', 'newPassword'] as const;

const ChangePasswordScreen = () => {
  const form = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', newPasswordConfirm: '' },
    mode: 'onChange',
  });
  const { step, setStep } = useStepper(STEPS);

  const handleNextStep = async () => {
    const isValid = await form.trigger(['currentPassword']);
    if (isValid) setStep('newPassword');
  };

  return (
    <View className="flex-1 bg-gray-1">
      <QueryErrorBoundary>
        <Suspense fallback={<View className="flex-1" />}>
          <FormProvider {...form}>
            {match(step)
              .with('currentPassword', () => <CurrentPasswordStep onNext={handleNextStep} />)
              .with('newPassword', () => <NewPasswordStep />)
              .exhaustive()}
          </FormProvider>
        </Suspense>
      </QueryErrorBoundary>
    </View>
  );
};

export default ChangePasswordScreen;

interface CurrentPasswordStepProps {
  onNext: () => void;
}

function CurrentPasswordStep({ onNext }: CurrentPasswordStepProps) {
  const { t } = useTranslation('auth');
  const { control } = useFormContext<ChangePasswordInput>();
  const { errors } = useFormState({ control, name: 'currentPassword' });
  const currentPassword = useWatch({ control, name: 'currentPassword' });
  const isValid = currentPassword.length > 0 && !errors.currentPassword;

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
          <H3>{t('changePassword.currentTitle')}</H3>
        </Animated.View>

        <Animated.View entering={FadeIn.duration(ANIMATION.duration.normal)}>
          <FormField control={control} name="currentPassword">
            {({ onChange, value }, { error }) => (
              <PasswordInput
                label={t('changePassword.currentLabel')}
                placeholder={t('changePassword.currentPlaceholder')}
                value={value}
                onChange={onChange}
                autoFocus
                submitBehavior="submit"
                returnKeyType="next"
                isInvalid={!!error}
                errorMessage={resolveValidationMessage(error, {
                  default: 'currentPassword.required',
                })}
                onSubmitEditing={() => {
                  if (isValid) {
                    onNext();
                  }
                }}
              />
            )}
          </FormField>
        </Animated.View>
      </ScrollView>

      <KeyboardAdaptiveButton onPress={onNext} isDisabled={!isValid}>
        {t('changePassword.next')}
      </KeyboardAdaptiveButton>
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

  const { control, handleSubmit } = useFormContext<ChangePasswordInput>();
  const { isSubmitting, errors } = useFormState({
    control,
    name: ['newPassword', 'newPasswordConfirm'],
  });

  const changePasswordMutation = useMutation(useChangePasswordMutationOptions());

  const [newPassword, newPasswordConfirm] = useWatch({
    control,
    name: ['newPassword', 'newPasswordConfirm'],
  });

  const isNextEnabled = match(step)
    .with('newPassword', () => newPassword.length > 0 && !errors.newPassword)
    .with(
      'newPasswordConfirm',
      () => newPasswordConfirm.length > 0 && !errors.newPassword && !errors.newPasswordConfirm,
    )
    .exhaustive();

  const handleNext = () => {
    match(step)
      .with('newPassword', () => setStep('newPasswordConfirm'))
      .with('newPasswordConfirm', () => {
        Keyboard.dismiss();
        handleSubmit(async (data) => {
          try {
            await changePasswordMutation.mutateAsync(data);
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
                    errorMessage={resolveValidationMessage(error, {
                      default: 'password.mismatch',
                    })}
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
        {step === 'newPasswordConfirm' ? t('changePassword.submit') : t('changePassword.next')}
      </KeyboardAdaptiveButton>
    </View>
  );
}
