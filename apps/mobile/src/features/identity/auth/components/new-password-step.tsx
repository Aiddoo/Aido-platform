import { ANIMATION } from '@src/shared/constants/animation';
import { useDismissKeyboard } from '@src/shared/hooks/use-dismiss-keyboard';
import { useTranslation } from '@src/shared/i18n';
import { KeyboardAdaptiveButton, VStack, FormStepLayout, Box, Spacing } from '@src/shared/ui';
import { type ComponentRef, useRef } from 'react';
import type { TextInput } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { match } from 'ts-pattern';

import { useFocusOnStepBack } from '../hooks/use-focus-on-step-back';
import { PasswordInput } from './password-input';
import { PasswordStrengthIndicator } from './password-strength-indicator';
import { RevealedField } from './revealed-field';

type NewPasswordStepName = 'newPassword' | 'newPasswordConfirm';

interface NewPasswordField {
  value: string;
  onChange: (value: string) => void;
  /** 이 칸에 적었는지. 단계 버튼과 확인 칸의 오류 문구가 적은 뒤에만 따른다 */
  isDirty: boolean;
  isInvalid: boolean;
  errorMessage?: string;
}

interface NewPasswordStepProps {
  title: string;
  /** 새 비밀번호 단계 다음 확인 단계는 새 비밀번호 칸 위에 확인 칸을 더한다 */
  step: NewPasswordStepName;
  /** 값과 오류는 부모 폼이 지켜 앞 단계로 돌아가도 입력이 남는다 */
  newPassword: NewPasswordField;
  newPasswordConfirm: NewPasswordField;
  isSubmitting: boolean;
  onNext: () => void;
  /** 연타 방지는 제출 함수를 가진 화면이 `useSingleTap`으로 한다 */
  onSubmit: () => void;
  nextLabel: string;
  submitLabel: string;
}

export function NewPasswordStep({
  title,
  step,
  newPassword,
  newPasswordConfirm,
  isSubmitting,
  onNext,
  onSubmit,
  nextLabel,
  submitLabel,
}: NewPasswordStepProps) {
  const dismissKeyboard = useDismissKeyboard();
  const { t } = useTranslation('auth');
  const newPasswordInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const newPasswordConfirmInputRef = useRef<ComponentRef<typeof TextInput>>(null);

  useFocusOnStepBack({
    step,
    firstStep: 'newPassword',
    focus: () => newPasswordInputRef.current?.focus(),
  });

  const isNewPasswordReady = newPassword.isDirty && !newPassword.isInvalid;
  // 새 비밀번호를 고치면 비어 있는 확인 칸도 다시 검사해 오류가 생긴다. 확인 칸에 적기 전에는 보이지 않는다
  const confirmErrorMessage = newPasswordConfirm.isDirty
    ? newPasswordConfirm.errorMessage
    : undefined;
  const isNextEnabled = match(step)
    .with('newPassword', () => isNewPasswordReady)
    .with(
      'newPasswordConfirm',
      () => isNewPasswordReady && newPasswordConfirm.isDirty && !newPasswordConfirm.isInvalid,
    )
    .exhaustive();

  const submit = () => {
    dismissKeyboard();
    onSubmit();
  };

  const handleNext = () => {
    if (!isNextEnabled || isSubmitting) {
      return;
    }
    match(step).with('newPassword', onNext).with('newPasswordConfirm', submit).exhaustive();
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
          <RevealedField onRevealed={() => newPasswordConfirmInputRef.current?.focus()}>
            <PasswordInput
              ref={newPasswordConfirmInputRef}
              label={t('forgotPassword.newPasswordConfirmLabel')}
              placeholder={t('forgotPassword.newPasswordConfirmPlaceholder')}
              value={newPasswordConfirm.value}
              onChange={newPasswordConfirm.onChange}
              textContentType="newPassword"
              autoComplete="new-password"
              returnKeyType="done"
              isInvalid={confirmErrorMessage != null}
              errorMessage={confirmErrorMessage}
              onSubmitEditing={handleNext}
            />
            <Spacing size={8} />
          </RevealedField>
        )}

        <Animated.View entering={FadeIn.duration(ANIMATION.durationMs.normal)}>
          <VStack gap={4}>
            <PasswordInput
              ref={newPasswordInputRef}
              label={t('forgotPassword.newPasswordLabel')}
              placeholder={t('forgotPassword.newPasswordPlaceholder')}
              value={newPassword.value}
              onChange={newPassword.onChange}
              textContentType="newPassword"
              autoComplete="new-password"
              autoFocus={step === 'newPassword'}
              submitBehavior="submit"
              returnKeyType="next"
              renderErrorMessage={false}
              onSubmitEditing={handleNext}
            />
            <PasswordStrengthIndicator password={newPassword.value} />
          </VStack>
        </Animated.View>
      </FormStepLayout>
    </Box>
  );
}
