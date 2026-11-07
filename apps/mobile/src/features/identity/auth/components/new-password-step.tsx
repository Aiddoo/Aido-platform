import { ANIMATION } from '@src/shared/constants/animation';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import { KeyboardAdaptiveButton, VStack, FormStepLayout, Box } from '@src/shared/ui';
import type { ComponentRef } from 'react';
import { useCallback, useRef, useState } from 'react';
import { type FieldError } from 'react-hook-form';
import type { TextInput } from 'react-native';
import { Keyboard } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { match } from 'ts-pattern';

import { PasswordInput } from './password-input';
import { PasswordStrengthIndicator } from './password-strength-indicator';
import { RevealedField } from './revealed-field';

const NEW_PASSWORD_SUB_STEPS = ['newPassword', 'newPasswordConfirm'] as const;
type NewPasswordSubStep = (typeof NEW_PASSWORD_SUB_STEPS)[number];

interface NewPasswordField {
  field: { value: string; onChange: (value: string) => void };
  fieldState: { error?: FieldError };
}

interface NewPasswordStepProps {
  title: string;
  /** 부모 폼의 필드. 값과 오류는 부모 폼이 지켜 앞 단계로 돌아가도 입력이 남는다 */
  newPassword: NewPasswordField;
  newPasswordConfirm: NewPasswordField;
  isSubmitting: boolean;
  /** 부모 폼의 handleSubmit으로 만든 제출 함수 */
  onSubmit: () => Promise<unknown>;
  nextLabel: string;
  submitLabel: string;
}

/** 새 비밀번호 입력 → 확인 입력 두 단계를 보여 주는 비밀번호 변경·재설정 공용 단계 */
export function NewPasswordStep({
  title,
  newPassword,
  newPasswordConfirm,
  isSubmitting,
  onSubmit,
  nextLabel,
  submitLabel,
}: NewPasswordStepProps) {
  const { t } = useTranslation('auth');
  const [step, setStep] = useState<NewPasswordSubStep>('newPassword');
  const newPasswordConfirmInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const focusConfirmInput = useCallback(() => {
    newPasswordConfirmInputRef.current?.focus();
  }, []);

  const isNextEnabled = match(step)
    .with('newPassword', () => newPassword.field.value.length > 0 && !newPassword.fieldState.error)
    .with(
      'newPasswordConfirm',
      () =>
        newPasswordConfirm.field.value.length > 0 &&
        !newPassword.fieldState.error &&
        !newPasswordConfirm.fieldState.error,
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
    <Box className="flex-1">
      <FormStepLayout title={title}>
        {step === 'newPasswordConfirm' && (
          <RevealedField onRevealed={focusConfirmInput}>
            <VStack mb={8}>
              <PasswordInput
                ref={newPasswordConfirmInputRef}
                label={t('forgotPassword.newPasswordConfirmLabel')}
                placeholder={t('forgotPassword.newPasswordConfirmPlaceholder')}
                value={newPasswordConfirm.field.value}
                onChange={newPasswordConfirm.field.onChange}
                textContentType="newPassword"
                autoComplete="new-password"
                returnKeyType="done"
                isInvalid={!!newPasswordConfirm.fieldState.error}
                errorMessage={resolveValidationMessage(newPasswordConfirm.fieldState.error, {
                  default: 'password.mismatch',
                })}
                onSubmitEditing={() => {
                  if (
                    newPasswordConfirm.field.value.length > 0 &&
                    !newPasswordConfirm.fieldState.error
                  ) {
                    handleNext();
                  }
                }}
              />
            </VStack>
          </RevealedField>
        )}

        <Animated.View entering={FadeIn.duration(ANIMATION.duration.normal)}>
          <VStack gap={4}>
            <PasswordInput
              label={t('forgotPassword.newPasswordLabel')}
              placeholder={t('forgotPassword.newPasswordPlaceholder')}
              value={newPassword.field.value}
              onChange={newPassword.field.onChange}
              textContentType="newPassword"
              autoComplete="new-password"
              autoFocus={step === 'newPassword'}
              submitBehavior="submit"
              returnKeyType="next"
              renderErrorMessage={false}
              onSubmitEditing={() => {
                if (newPassword.field.value.length > 0 && !newPassword.fieldState.error) {
                  handleNext();
                }
              }}
            />
            <PasswordStrengthIndicator password={newPassword.field.value} />
          </VStack>
        </Animated.View>
      </FormStepLayout>

      <KeyboardAdaptiveButton
        onPress={handleNext}
        isDisabled={!isNextEnabled}
        isLoading={isSubmitting}
      >
        {step === 'newPasswordConfirm' ? submitLabel : nextLabel}
      </KeyboardAdaptiveButton>
    </Box>
  );
}
