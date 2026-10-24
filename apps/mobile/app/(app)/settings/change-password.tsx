import { type ChangePasswordInput, changePasswordSchema } from '@aido/api';
import { zodResolver } from '@hookform/resolvers/zod';
import { NewPasswordStep } from '@src/features/auth/components/new-password-step';
import { PasswordInput } from '@src/features/auth/components/password-input';
import { useChangePasswordMutationOptions } from '@src/features/auth/queries/use-change-password-mutation-options';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { isBusinessError } from '@src/shared/errors/result';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import { H3, KeyboardAdaptiveButton, QueryErrorBoundary, StyledSafeAreaView } from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useErrorBoundary } from 'react-error-boundary';
import { useFormState, FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { match } from 'ts-pattern';

const STEPS = ['currentPassword', 'newPassword'] as const;
type ChangePasswordStep = (typeof STEPS)[number];

function ChangePasswordScreen() {
  const form = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', newPasswordConfirm: '' },
    mode: 'onChange',
  });
  const [step, setStep] = useState<ChangePasswordStep>('currentPassword');
  const { showBoundary } = useErrorBoundary();
  const changePassword = useMutation(useChangePasswordMutationOptions());
  const { t } = useTranslation('auth');

  const submitNewPassword = form.handleSubmit(async (input) => {
    try {
      await changePassword.mutateAsync(input);
    } catch (error) {
      if (!isBusinessError(error)) {
        showBoundary(error);
      }
    }
  });

  const handleNextStep = async () => {
    const isValid = await form.trigger(['currentPassword']);
    if (isValid) {
      setStep('newPassword');
    }
  };

  return (
    <View className="flex-1 bg-gray-1">
      <FormProvider {...form}>
        {match(step)
          .with('currentPassword', () => <CurrentPasswordStep onNext={handleNextStep} />)
          .with('newPassword', () => (
            <NewPasswordStep
              onSubmit={submitNewPassword}
              nextLabel={t('changePassword.next')}
              submitLabel={t('changePassword.submit')}
            />
          ))
          .exhaustive()}
      </FormProvider>
    </View>
  );
}

/** 제출 중 예측하지 못한 오류(showBoundary)를 이 화면 안에서 받아 다시 시도하게 한다. */
export default function ChangePasswordRoute() {
  return (
    <QueryErrorBoundary>
      <ChangePasswordScreen />
    </QueryErrorBoundary>
  );
}

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
        <StyledSafeAreaView edges={['left', 'right']}>
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
        </StyledSafeAreaView>
      </ScrollView>

      <KeyboardAdaptiveButton onPress={onNext} isDisabled={!isValid}>
        {t('changePassword.next')}
      </KeyboardAdaptiveButton>
    </View>
  );
}
