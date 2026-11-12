import { ANIMATION } from '@src/shared/constants/animation';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import { KeyboardAdaptiveButton, VStack, FormStepLayout, Box } from '@src/shared/ui';
import type { ComponentRef } from 'react';
import { useCallback, useRef } from 'react';
import { type ControllerFieldState } from 'react-hook-form';
import type { TextInput } from 'react-native';
import { Keyboard } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { match } from 'ts-pattern';

import { useFocusOnStepBack } from '../hooks/use-focus-on-step-back';
import { PasswordInput } from './password-input';
import { PasswordStrengthIndicator } from './password-strength-indicator';
import { RevealedField } from './revealed-field';

type NewPasswordStepName = 'newPassword' | 'newPasswordConfirm';

interface NewPasswordField {
  field: { value: string; onChange: (value: string) => void };
  fieldState: Pick<ControllerFieldState, 'error' | 'isDirty' | 'invalid'>;
}

interface NewPasswordStepProps {
  title: string;
  /** 새 비밀번호 단계 다음 확인 단계는 새 비밀번호 칸 위에 확인 칸을 더한다 */
  step: NewPasswordStepName;
  /** 값과 오류는 부모 폼이 지켜 앞 단계로 돌아가도 입력이 남는다 */
  newPassword: NewPasswordField;
  newPasswordConfirm: NewPasswordField;
  isSubmitting: boolean;
  onNextStep: () => void;
  onSubmit: () => Promise<unknown>;
  nextLabel: string;
  submitLabel: string;
}

export function NewPasswordStep({
  title,
  step,
  newPassword,
  newPasswordConfirm,
  isSubmitting,
  onNextStep,
  onSubmit,
  nextLabel,
  submitLabel,
}: NewPasswordStepProps) {
  const { t } = useTranslation('auth');
  const newPasswordInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const newPasswordConfirmInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const focusConfirmInput = useCallback(() => {
    newPasswordConfirmInputRef.current?.focus();
  }, []);

  useFocusOnStepBack({
    step,
    firstStep: 'newPassword',
    focus: () => newPasswordInputRef.current?.focus(),
  });

  const isNewPasswordReady = newPassword.fieldState.isDirty && !newPassword.fieldState.invalid;
  // 새 비밀번호를 고치면 비어 있는 확인 칸도 다시 검사해 오류가 생긴다. 확인 칸에 적기 전에는 보이지 않는다
  const confirmError = newPasswordConfirm.fieldState.isDirty
    ? newPasswordConfirm.fieldState.error
    : undefined;
  const isNextEnabled = match(step)
    .with('newPassword', () => isNewPasswordReady)
    .with(
      'newPasswordConfirm',
      () =>
        isNewPasswordReady &&
        newPasswordConfirm.fieldState.isDirty &&
        !newPasswordConfirm.fieldState.invalid,
    )
    .exhaustive();

  const handleNext = () => {
    if (!isNextEnabled || isSubmitting) {
      return;
    }
    match(step)
      .with('newPassword', onNextStep)
      .with('newPasswordConfirm', () => {
        Keyboard.dismiss();
        return onSubmit();
      })
      .exhaustive();
  };

  return (
    <Box className="flex-1">
      <FormStepLayout
        title={title}
        footer={
          <KeyboardAdaptiveButton
            onPress={handleNext}
            isDisabled={!isNextEnabled}
            isLoading={isSubmitting}
          >
            {step === 'newPasswordConfirm' ? submitLabel : nextLabel}
          </KeyboardAdaptiveButton>
        }
      >
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
                isInvalid={confirmError != null}
                errorMessage={resolveValidationMessage(confirmError, {
                  default: 'password.mismatch',
                })}
                onSubmitEditing={handleNext}
              />
            </VStack>
          </RevealedField>
        )}

        <Animated.View entering={FadeIn.duration(ANIMATION.durationMs.normal)}>
          <VStack gap={4}>
            <PasswordInput
              ref={newPasswordInputRef}
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
              onSubmitEditing={handleNext}
            />
            <PasswordStrengthIndicator password={newPassword.field.value} />
          </VStack>
        </Animated.View>
      </FormStepLayout>
    </Box>
  );
}
