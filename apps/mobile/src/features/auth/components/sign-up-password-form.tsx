import { passwordSchema } from '@aido/api';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import { KeyboardAdaptiveButton, VStack, FormStepLayout } from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import type { ComponentRef } from 'react';
import { useCallback, useRef, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { TextInput } from 'react-native';
import { Keyboard, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { match } from 'ts-pattern';

import type { SignUpFormInput } from '../domains/sign-up-form.schema';
import { PasswordInput } from './password-input';
import { PasswordStrengthIndicator } from './password-strength-indicator';
import { TermsBottomSheet } from './terms-bottom-sheet';

const PASSWORD_STEPS = ['password', 'passwordConfirm'] as const;
type PasswordStep = (typeof PASSWORD_STEPS)[number];

interface SignUpPasswordFormProps {
  /** 약관 동의 후 호출하는 회원가입 제출 함수. 폼과 mutation은 화면이 소유한다. */
  onSubmit: () => Promise<unknown>;
}

export function SignUpPasswordForm({ onSubmit }: SignUpPasswordFormProps) {
  const { t } = useTranslation('auth');
  const { control } = useFormContext<SignUpFormInput>();
  const [password, passwordConfirm] = useWatch({ control, name: ['password', 'passwordConfirm'] });
  const [step, setStep] = useState<PasswordStep>('password');
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const passwordConfirmInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const focusPasswordConfirmInput = useCallback(() => {
    passwordConfirmInputRef.current?.focus();
  }, []);

  const isPasswordValid = passwordSchema.safeParse(password).success;
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
      <View className="flex-1">
        <FormStepLayout title={t('signUp.passwordTitle')}>
          {step === 'passwordConfirm' && (
            <Animated.View
              entering={FadeInUp.duration(ANIMATION.duration.slow)
                .delay(ANIMATION.delay.short)
                .withCallback((finished) => {
                  'worklet';
                  if (finished) {
                    scheduleOnRN(focusPasswordConfirmInput);
                  }
                })}
            >
              <VStack mb={20}>
                <FormField control={control} name="passwordConfirm">
                  {({ onChange, value }, { error }) => (
                    <PasswordInput
                      ref={passwordConfirmInputRef}
                      label={t('signUp.passwordConfirmLabel')}
                      placeholder={t('signUp.passwordConfirmPlaceholder')}
                      value={value}
                      onChange={onChange}
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
                </FormField>
              </VStack>
            </Animated.View>
          )}

          <Animated.View entering={FadeIn.duration(ANIMATION.duration.normal)}>
            <FormField control={control} name="password">
              {({ onChange, value }, { error }) => (
                <VStack gap={8}>
                  <PasswordInput
                    label={t('signUp.passwordLabel')}
                    placeholder={t('signUp.passwordPlaceholder')}
                    value={value}
                    onChange={onChange}
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
            </FormField>
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
      </View>

      <TermsBottomSheet isOpen={isTermsOpen} onOpenChange={setIsTermsOpen} onSubmit={onSubmit} />
    </>
  );
}
