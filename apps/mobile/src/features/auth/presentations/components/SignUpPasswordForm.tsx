import { passwordSchema } from '@aido/validators';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { useStepper } from '@src/shared/hooks/useStepper';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import { H3, KeyboardAdaptiveButton, VStack } from '@src/shared/ui';
import { FormField } from '@src/shared/ui/FormField/FormField';
import type { ComponentRef } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { TextInput } from 'react-native';
import { Keyboard, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { match } from 'ts-pattern';

import type { SignUpFormData } from '../schemas/sign-up-form.schema';
import { PasswordInput } from './PasswordInput';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
import { TermsBottomSheet } from './TermsBottomSheet';

const PASSWORD_STEPS = ['password', 'passwordConfirm'] as const;

interface SignUpPasswordFormProps {
  onNextStep: () => void;
}

export const SignUpPasswordForm = ({ onNextStep }: SignUpPasswordFormProps) => {
  const { t } = useTranslation('auth');
  const { control } = useFormContext<SignUpFormData>();
  const [password, passwordConfirm] = useWatch({ control, name: ['password', 'passwordConfirm'] });
  const { step, setStep } = useStepper(PASSWORD_STEPS);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const passwordConfirmInputRef = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (step !== 'passwordConfirm') return;

    const passwordConfirmFocusTimeoutId = setTimeout(() => {
      passwordConfirmInputRef.current?.focus();
    }, 350);

    return () => clearTimeout(passwordConfirmFocusTimeoutId);
  }, [step]);

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
            <H3>{t('signUp.passwordTitle')}</H3>
          </Animated.View>

          {step === 'passwordConfirm' && (
            <Animated.View
              entering={FadeInUp.duration(ANIMATION.duration.slow).delay(ANIMATION.delay.short)}
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
                      errorMessage={error?.message}
                      onSubmitEditing={() => {
                        if (isPasswordConfirmValid) handleNext();
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
                      if (isPasswordValid) handleNext();
                    }}
                  />

                  <PasswordStrengthIndicator password={password} />
                </VStack>
              )}
            </FormField>
          </Animated.View>
        </ScrollView>

        <KeyboardAdaptiveButton
          color="dark"
          onPress={handleNext}
          isDisabled={!isNextEnabled}
          enabled={!isTermsOpen}
        >
          {t('signUp.next')}
        </KeyboardAdaptiveButton>
      </View>

      <TermsBottomSheet
        isOpen={isTermsOpen}
        onOpenChange={setIsTermsOpen}
        onNextStep={onNextStep}
      />
    </>
  );
};
