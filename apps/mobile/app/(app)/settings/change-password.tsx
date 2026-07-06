import { type ChangePasswordInput, changePasswordSchema } from '@aido/validators';
import { zodResolver } from '@hookform/resolvers/zod';
import { PasswordInput } from '@src/features/auth/presentations/components/PasswordInput';
import { PasswordStrengthIndicator } from '@src/features/auth/presentations/components/PasswordStrengthIndicator';
import { useChangePasswordMutationOptions } from '@src/features/auth/presentations/queries/use-change-password-mutation-options';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { useStepper } from '@src/shared/hooks/useStepper';
import { useTranslation } from '@src/shared/i18n';
import { H3, KeyboardAdaptiveButton, QueryErrorBoundary, VStack } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { Suspense, useCallback, useRef } from 'react';
import { Controller, FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';
import { Keyboard, ScrollView, type TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { match } from 'ts-pattern';

const STEPS = ['currentPassword', 'newPassword'] as const;

const ChangePasswordScreen = () => {
  const form = useForm<ChangePasswordInput>({
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
  const {
    control,
    formState: { errors },
  } = useFormContext<ChangePasswordInput>();
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
          <Controller
            control={control}
            name="currentPassword"
            render={({ field: { onChange, value } }) => (
              <PasswordInput
                label={t('changePassword.currentLabel')}
                placeholder={t('changePassword.currentPlaceholder')}
                value={value}
                onChangeText={onChange}
                autoFocus
                submitBehavior="submit"
                returnKeyType="next"
                isInvalid={!!errors.currentPassword}
                errorMessage={errors.currentPassword?.message}
                onSubmitEditing={() => {
                  if (isValid) {
                    onNext();
                  }
                }}
              />
            )}
          />
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
  const { t } = useTranslation('auth');
  const { step, setStep } = useStepper(NEW_PASSWORD_SUB_STEPS);
  const newPasswordConfirmInputRef = useRef<TextInput>(null);
  const focusConfirmInput = useCallback(() => {
    newPasswordConfirmInputRef.current?.focus();
  }, []);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useFormContext<ChangePasswordInput>();
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
        handleSubmit((data) => {
          changePasswordMutation.mutate(data);
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
              <Controller
                control={control}
                name="newPasswordConfirm"
                render={({ field: { onChange, value } }) => (
                  <PasswordInput
                    ref={newPasswordConfirmInputRef}
                    label={t('forgotPassword.newPasswordConfirmLabel')}
                    placeholder={t('forgotPassword.newPasswordConfirmPlaceholder')}
                    value={value}
                    onChangeText={onChange}
                    returnKeyType="done"
                    isInvalid={!!errors.newPasswordConfirm}
                    errorMessage={errors.newPasswordConfirm?.message}
                    onSubmitEditing={() => {
                      if (newPasswordConfirm.length > 0 && !errors.newPasswordConfirm) handleNext();
                    }}
                  />
                )}
              />
            </VStack>
          </Animated.View>
        )}

        <Animated.View entering={FadeIn.duration(ANIMATION.duration.normal)}>
          <Controller
            control={control}
            name="newPassword"
            render={({ field: { onChange, value } }) => (
              <VStack gap={4}>
                <PasswordInput
                  label={t('forgotPassword.newPasswordLabel')}
                  placeholder={t('forgotPassword.newPasswordPlaceholder')}
                  value={value}
                  onChangeText={onChange}
                  autoFocus={step === 'newPassword'}
                  submitBehavior="submit"
                  returnKeyType="next"
                  renderErrorMessage={false}
                  onSubmitEditing={() => {
                    if (newPassword.length > 0 && !errors.newPassword) handleNext();
                  }}
                />
                <PasswordStrengthIndicator password={newPassword} />
              </VStack>
            )}
          />
        </Animated.View>
      </ScrollView>

      <KeyboardAdaptiveButton
        onPress={handleNext}
        isDisabled={!isNextEnabled}
        isLoading={changePasswordMutation.isPending}
      >
        {step === 'newPasswordConfirm' ? t('changePassword.submit') : t('changePassword.next')}
      </KeyboardAdaptiveButton>
    </View>
  );
}
