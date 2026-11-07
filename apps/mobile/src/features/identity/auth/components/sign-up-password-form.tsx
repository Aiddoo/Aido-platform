import { ANIMATION } from '@src/shared/constants/animation';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import { KeyboardAdaptiveButton, VStack, FormStepLayout, Box } from '@src/shared/ui';
import { useCallback, useState } from 'react';
import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';
import { Keyboard } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { match } from 'ts-pattern';

import type { SignUpFormInput } from '../schemas/sign-up-form.schema';
import { signUpPasswordSchema } from '../schemas/sign-up-form.schema';
import { PasswordInput } from './password-input';
import { PasswordStrengthIndicator } from './password-strength-indicator';
import { RevealedField } from './revealed-field';
import { TermsBottomSheet } from './terms-bottom-sheet';

const PASSWORD_STEPS = ['password', 'passwordConfirm'] as const;
type PasswordStep = (typeof PASSWORD_STEPS)[number];

interface SignUpPasswordFormProps {
  form: UseFormReturn<SignUpFormInput>;
  /** 약관 동의 후 호출하는 회원가입 제출 함수 */
  onSubmit: () => Promise<unknown>;
}

export function SignUpPasswordForm({ form, onSubmit }: SignUpPasswordFormProps) {
  const { t } = useTranslation('auth');
  const { control } = form;
  const [password, passwordConfirm] = useWatch({ control, name: ['password', 'passwordConfirm'] });
  const [step, setStep] = useState<PasswordStep>('password');
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const focusPasswordConfirmInput = useCallback(() => {
    form.setFocus('passwordConfirm');
  }, [form]);

  const isPasswordValid = signUpPasswordSchema.safeParse(password).success;
  const isPasswordConfirmValid = isPasswordValid && password === passwordConfirm;

  const handleNext = () => {
    match(step)
      .with('password', () => {
        setStep('passwordConfirm');
      })
      .with('passwordConfirm', () => {
        Keyboard.dismiss();
        setIsTermsOpen(true);
      })
      .exhaustive();
  };

  const isNextEnabled = match(step)
    .with('password', () => isPasswordValid)
    .with('passwordConfirm', () => isPasswordConfirmValid)
    .exhaustive();

  return (
    <>
      <Box className="flex-1">
        <FormStepLayout title={t('signUp.passwordTitle')}>
          {step === 'passwordConfirm' && (
            <RevealedField onRevealed={focusPasswordConfirmInput}>
              <VStack mb={20}>
                <Controller
                  control={control}
                  name="passwordConfirm"
                  render={({ field: { ref, onChange, value }, fieldState: { error } }) => (
                    <PasswordInput
                      ref={ref}
                      label={t('signUp.passwordConfirmLabel')}
                      placeholder={t('signUp.passwordConfirmPlaceholder')}
                      value={value}
                      onChange={onChange}
                      textContentType="newPassword"
                      autoComplete="new-password"
                      returnKeyType="done"
                      isInvalid={!!error}
                      errorMessage={resolveValidationMessage(error, {
                        default: 'password.mismatch',
                      })}
                      onSubmitEditing={() => {
                        if (isPasswordConfirmValid) {
                          handleNext();
                        }
                      }}
                    />
                  )}
                />
              </VStack>
            </RevealedField>
          )}

          <Animated.View entering={FadeIn.duration(ANIMATION.duration.normal)}>
            <Controller
              control={control}
              name="password"
              render={({ field: { ref, onChange, value }, fieldState: { error } }) => (
                <VStack gap={8}>
                  <PasswordInput
                    ref={ref}
                    label={t('signUp.passwordLabel')}
                    placeholder={t('signUp.passwordPlaceholder')}
                    value={value}
                    onChange={onChange}
                    textContentType="newPassword"
                    autoComplete="new-password"
                    autoFocus={step === 'password'}
                    submitBehavior="submit"
                    returnKeyType="next"
                    isInvalid={!!error}
                    errorMessage={resolveValidationMessage(error, {
                      default: 'password.pattern',
                      byType: { too_small: 'password.tooShort', too_big: 'password.tooLong' },
                    })}
                    renderErrorMessage={false}
                    onSubmitEditing={() => {
                      if (isPasswordValid) {
                        handleNext();
                      }
                    }}
                  />

                  <PasswordStrengthIndicator password={password} />
                </VStack>
              )}
            />
          </Animated.View>
        </FormStepLayout>

        <KeyboardAdaptiveButton
          color="dark"
          onPress={handleNext}
          isDisabled={!isNextEnabled}
          enabled={!isTermsOpen}
        >
          {t('signUp.next')}
        </KeyboardAdaptiveButton>
      </Box>

      <TermsBottomSheet
        form={form}
        isOpen={isTermsOpen}
        onOpenChange={setIsTermsOpen}
        onSubmit={onSubmit}
      />
    </>
  );
}
