import { ANIMATION } from '@src/shared/constants/animation.constants';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import {
  Input,
  KeyboardAdaptiveButton,
  Spacing,
  VStack,
  FormStepLayout,
  Box,
} from '@src/shared/ui';
import { FormField } from '@src/shared/ui/form-field/form-field';
import type { ComponentRef } from 'react';
import { useCallback, useRef, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { TextInput } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { match } from 'ts-pattern';

import { type SignUpFormInput, signUpFormSchema } from '../domains/sign-up-form.schema';
import { SuggestedEmailDomainList } from './suggested-email-domain-list';

const USER_INFO_STEPS = ['name', 'email'] as const;
type UserInfoStep = (typeof USER_INFO_STEPS)[number];

const STEP_DESCRIPTION_KEYS = {
  name: 'auth:signUp.nameTitle',
  email: 'auth:signUp.emailTitle',
} as const satisfies Record<UserInfoStep, string>;

interface SignUpUserInfoFormProps {
  onNextStep: () => void;
}

export function SignUpUserInfoForm({ onNextStep }: SignUpUserInfoFormProps) {
  const { t } = useTranslation(['auth']);
  const { control } = useFormContext<SignUpFormInput>();
  const [email, name] = useWatch({ control, name: ['email', 'name'] });
  const [step, setStep] = useState<UserInfoStep>('name');
  const emailInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const focusEmailInput = useCallback(() => {
    emailInputRef.current?.focus();
  }, []);

  const handleNext = () => {
    match(step)
      .with('name', () => {
        setStep('email');
      })
      .with('email', () => onNextStep())
      .exhaustive();
  };

  const isNameValid = signUpFormSchema.shape.name.safeParse(name).success;
  const isEmailValid = signUpFormSchema.shape.email.safeParse(email).success;

  const isNextButtonEnabled = match(step)
    .with('name', () => isNameValid)
    .with('email', () => isNameValid && isEmailValid)
    .exhaustive();

  return (
    <Box className="flex-1">
      <FormStepLayout title={t(STEP_DESCRIPTION_KEYS[step])}>
        {step === 'email' && (
          <Animated.View
            entering={FadeInUp.duration(ANIMATION.duration.slow)
              .delay(ANIMATION.delay.short)
              .withCallback((finished) => {
                'worklet';
                if (finished) {
                  scheduleOnRN(focusEmailInput);
                }
              })}
          >
            <FormField control={control} name="email">
              {({ onChange, value }, { error }) => (
                <VStack gap={8}>
                  <Input
                    ref={emailInputRef}
                    label={t('auth:signUp.emailLabel')}
                    placeholder="example@email.com"
                    value={value}
                    onChange={onChange}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect={false}
                    submitBehavior="submit"
                    returnKeyType="next"
                    isInvalid={!!error}
                    errorMessage={resolveValidationMessage(error, {
                      default: 'email.invalid',
                      byType: { too_big: 'email.tooLong' },
                    })}
                    onSubmitEditing={() => {
                      if (isEmailValid) {
                        handleNext();
                      }
                    }}
                  />
                  <SuggestedEmailDomainList value={value} onChange={onChange} />
                </VStack>
              )}
            </FormField>
            <Spacing size={20} />
          </Animated.View>
        )}

        <Animated.View entering={FadeIn.duration(ANIMATION.duration.normal)}>
          <FormField control={control} name="name">
            {({ onChange, value }, { error }) => (
              <Input
                label={t('auth:signUp.nicknameLabel')}
                placeholder={t('auth:signUp.nicknamePlaceholder')}
                value={value}
                onChange={onChange}
                autoCapitalize="none"
                submitBehavior="submit"
                autoFocus={step === 'name'}
                returnKeyType="next"
                isInvalid={!!error}
                errorMessage={resolveValidationMessage(error, {
                  default: 'nickname.required',
                  byType: { too_big: 'nickname.tooLong' },
                })}
                onSubmitEditing={() => {
                  if (isNameValid) {
                    handleNext();
                  }
                }}
              />
            )}
          </FormField>
        </Animated.View>
      </FormStepLayout>

      <KeyboardAdaptiveButton color="dark" onPress={handleNext} isDisabled={!isNextButtonEnabled}>
        {t('auth:signUp.next')}
      </KeyboardAdaptiveButton>
    </Box>
  );
}
