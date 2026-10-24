import { PasswordInput } from '@src/features/auth/components/password-input';
import { PasswordStrengthIndicator } from '@src/features/auth/components/password-strength-indicator';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import { KeyboardAdaptiveButton, VStack, FormStepLayout } from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import type { ComponentRef } from 'react';
import { useCallback, useRef, useState } from 'react';
import { useFormContext, useFormState, useWatch } from 'react-hook-form';
import type { TextInput } from 'react-native';
import { Keyboard, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { match } from 'ts-pattern';

const NEW_PASSWORD_SUB_STEPS = ['newPassword', 'newPasswordConfirm'] as const;
type NewPasswordSubStep = (typeof NEW_PASSWORD_SUB_STEPS)[number];

interface NewPasswordFields {
  newPassword: string;
  newPasswordConfirm: string;
}

interface NewPasswordStepProps {
  /** 부모 폼의 handleSubmit으로 만든 제출 함수. 폼과 mutation은 화면 부모가 소유한다. */
  onSubmit: () => Promise<unknown>;
  nextLabel: string;
  submitLabel: string;
}

/** 새 비밀번호 입력 → 확인 입력 두 단계를 보여 주는 비밀번호 변경·재설정 공용 단계 */
export function NewPasswordStep({ onSubmit, nextLabel, submitLabel }: NewPasswordStepProps) {
  const { t } = useTranslation('auth');
  const [step, setStep] = useState<NewPasswordSubStep>('newPassword');
  const newPasswordConfirmInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const focusConfirmInput = useCallback(() => {
    newPasswordConfirmInputRef.current?.focus();
  }, []);

  const { control } = useFormContext<NewPasswordFields>();
  const { isSubmitting, errors } = useFormState({
    control,
    name: ['newPassword', 'newPasswordConfirm'],
  });

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
        return onSubmit();
      })
      .exhaustive();
  };

  return (
    <View className="flex-1">
      <FormStepLayout title={t('forgotPassword.newPasswordTitle')}>
        {step === 'newPasswordConfirm' && (
          <Animated.View
            entering={FadeInUp.duration(ANIMATION.duration.slow)
              .delay(ANIMATION.delay.short)
              .withCallback((finished) => {
                'worklet';
                if (finished) {
                  scheduleOnRN(focusConfirmInput);
                }
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
                      if (newPasswordConfirm.length > 0 && !error) {
                        handleNext();
                      }
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
                    if (newPassword.length > 0 && !error) {
                      handleNext();
                    }
                  }}
                />
                <PasswordStrengthIndicator password={newPassword} />
              </VStack>
            )}
          </FormField>
        </Animated.View>
      </FormStepLayout>

      <KeyboardAdaptiveButton
        onPress={handleNext}
        isDisabled={!isNextEnabled}
        isLoading={isSubmitting}
      >
        {step === 'newPasswordConfirm' ? submitLabel : nextLabel}
      </KeyboardAdaptiveButton>
    </View>
  );
}
