import { ANIMATION } from '@src/shared/constants/animation';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import { KeyboardAdaptiveButton, VStack, FormStepLayout, Box, Spacing } from '@src/shared/ui';
import { useCallback, useState } from 'react';
import { Controller, type UseFormReturn, useFormState, useWatch } from 'react-hook-form';
import { Keyboard } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { match } from 'ts-pattern';

import { useFocusOnStepBack } from '../../hooks/use-focus-on-step-back';
import { type SignUpFormValues } from '../../schemas/sign-up-form.schema';
import { PasswordInput } from '../password-input';
import { PasswordStrengthIndicator } from '../password-strength-indicator';
import { RevealedField } from '../revealed-field';
import { TermsAgreementBottomSheet } from '../terms-agreement-bottom-sheet';

type PasswordStep = 'password' | 'passwordConfirm';

interface SignUpPasswordFormProps {
  form: UseFormReturn<SignUpFormValues>;
  /** 비밀번호 단계 다음 확인 단계는 비밀번호 칸 위에 확인 칸을 더한다 */
  step: PasswordStep;
  onNextStep: () => void;
  /** 약관 동의 후 호출하는 회원가입 제출 함수 */
  onSubmit: () => Promise<boolean>;
}

export function SignUpPasswordForm({ form, step, onNextStep, onSubmit }: SignUpPasswordFormProps) {
  const { t } = useTranslation('auth');
  const { control } = form;
  const formState = useFormState({ control, name: ['password', 'passwordConfirm'] });
  const passwordValue = useWatch({ control, name: 'password' });

  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const focusPasswordConfirmInput = useCallback(() => {
    form.setFocus('passwordConfirm');
  }, [form]);

  useFocusOnStepBack({ step, firstStep: 'password', focus: () => form.setFocus('password') });

  const password = form.getFieldState('password', formState);
  const passwordConfirm = form.getFieldState('passwordConfirm', formState);
  const isPasswordReady = password.isDirty && !password.invalid;
  const isNextEnabled = match(step)
    .with('password', () => isPasswordReady)
    .with(
      'passwordConfirm',
      () => isPasswordReady && passwordConfirm.isDirty && !passwordConfirm.invalid,
    )
    .exhaustive();

  const submitStep = () => {
    if (!isNextEnabled) {
      return;
    }
    match(step)
      .with('password', onNextStep)
      .with('passwordConfirm', () => {
        Keyboard.dismiss();
        setIsTermsOpen(true);
      })
      .exhaustive();
  };

  return (
    <>
      <Box className="flex-1">
        <FormStepLayout
          title={t('signUp.passwordTitle')}
          footer={
            <KeyboardAdaptiveButton
              color="dark"
              onPress={submitStep}
              isDisabled={!isNextEnabled}
              enabled={!isTermsOpen}
            >
              {t('signUp.next')}
            </KeyboardAdaptiveButton>
          }
        >
          {step === 'passwordConfirm' && (
            <RevealedField onRevealed={focusPasswordConfirmInput}>
              <Controller
                control={control}
                name="passwordConfirm"
                render={({ field: { ref, onChange, onBlur, value }, fieldState }) => {
                  const error = fieldState.isTouched ? fieldState.error : undefined;
                  return (
                    <PasswordInput
                      ref={ref}
                      label={t('signUp.passwordConfirmLabel')}
                      placeholder={t('signUp.passwordConfirmPlaceholder')}
                      value={value}
                      onChange={onChange}
                      onBlur={onBlur}
                      textContentType="newPassword"
                      autoComplete="new-password"
                      returnKeyType="done"
                      isInvalid={error != null}
                      errorMessage={resolveValidationMessage(error, {
                        default: 'password.mismatch',
                      })}
                      onSubmitEditing={submitStep}
                    />
                  );
                }}
              />
              <Spacing size={20} />
            </RevealedField>
          )}

          <Animated.View entering={FadeIn.duration(ANIMATION.durationMs.normal)}>
            <Controller
              control={control}
              name="password"
              // 비밀번호를 고치면 이미 적은 확인 칸의 일치 여부도 다시 본다
              rules={{ deps: 'passwordConfirm' }}
              render={({ field: { ref, onChange, onBlur, value }, fieldState }) => {
                const error = fieldState.isTouched ? fieldState.error : undefined;
                return (
                  <VStack gap={8}>
                    <PasswordInput
                      ref={ref}
                      label={t('signUp.passwordLabel')}
                      placeholder={t('signUp.passwordPlaceholder')}
                      value={value}
                      onChange={onChange}
                      onBlur={onBlur}
                      textContentType="newPassword"
                      autoComplete="new-password"
                      autoFocus={step === 'password'}
                      submitBehavior="submit"
                      returnKeyType="next"
                      isInvalid={error != null}
                      errorMessage={resolveValidationMessage(error, {
                        default: 'password.pattern',
                        byType: { too_small: 'password.tooShort', too_big: 'password.tooLong' },
                      })}
                      renderErrorMessage={false}
                      onSubmitEditing={submitStep}
                    />

                    <PasswordStrengthIndicator password={passwordValue} />
                  </VStack>
                );
              }}
            />
          </Animated.View>
        </FormStepLayout>
      </Box>

      <TermsAgreementBottomSheet
        form={form}
        isOpen={isTermsOpen}
        onOpenChange={setIsTermsOpen}
        onSubmit={onSubmit}
      />
    </>
  );
}
