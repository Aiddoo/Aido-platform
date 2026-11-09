import { ANIMATION } from '@src/shared/constants/animation';
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
import { useCallback, useState } from 'react';
import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';
import Animated, { FadeIn } from 'react-native-reanimated';
import { match } from 'ts-pattern';

import { type SignUpFormValues, signUpFormSchema } from '../schemas/sign-up-form.schema';
import { RevealedField } from './revealed-field';
import { SuggestedEmailDomainList } from './suggested-email-domain-list';

type UserInfoStep = 'name' | 'email';

const STEP_DESCRIPTION_KEYS = {
  name: 'auth:signUp.nameTitle',
  email: 'auth:signUp.emailTitle',
} as const satisfies Record<UserInfoStep, string>;

interface SignUpUserInfoFormProps {
  form: UseFormReturn<SignUpFormValues>;
  onNextStep: () => void;
}

export function SignUpUserInfoForm({ form, onNextStep }: SignUpUserInfoFormProps) {
  const { t } = useTranslation(['auth']);
  const { control } = form;
  const [email, name] = useWatch({ control, name: ['email', 'name'] });
  const [step, setStep] = useState<UserInfoStep>(() =>
    form.formState.errors.name == null && form.formState.errors.email != null ? 'email' : 'name',
  );
  const focusEmailInput = useCallback(() => {
    form.setFocus('email');
  }, [form]);

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
      <FormStepLayout
        title={t(STEP_DESCRIPTION_KEYS[step])}
        footer={
          <KeyboardAdaptiveButton
            color="dark"
            onPress={handleNext}
            isDisabled={!isNextButtonEnabled}
          >
            {t('auth:signUp.next')}
          </KeyboardAdaptiveButton>
        }
      >
        {step === 'email' && (
          <RevealedField onRevealed={focusEmailInput}>
            <Controller
              control={control}
              name="email"
              render={({ field: { ref, onChange, onBlur, value }, fieldState: { error } }) => (
                <VStack gap={8}>
                  <Input
                    ref={ref}
                    label={t('auth:signUp.emailLabel')}
                    placeholder={t('auth:signUp.emailPlaceholder')}
                    value={value}
                    onChange={onChange}
                    onBlur={onBlur}
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
                      if (isNextButtonEnabled) {
                        handleNext();
                      }
                    }}
                  />
                  <SuggestedEmailDomainList value={value} onChange={onChange} />
                </VStack>
              )}
            />
            <Spacing size={20} />
          </RevealedField>
        )}

        <Animated.View entering={FadeIn.duration(ANIMATION.duration.normal)}>
          <Controller
            control={control}
            name="name"
            render={({ field: { ref, onChange, onBlur, value }, fieldState: { error } }) => (
              <Input
                ref={ref}
                label={t('auth:signUp.nicknameLabel')}
                placeholder={t('auth:signUp.nicknamePlaceholder')}
                value={value}
                onChange={onChange}
                onBlur={onBlur}
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
                  if (isNextButtonEnabled) {
                    handleNext();
                  }
                }}
              />
            )}
          />
        </Animated.View>
      </FormStepLayout>
    </Box>
  );
}
