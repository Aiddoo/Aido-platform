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
import { useCallback } from 'react';
import { Controller, type UseFormReturn, useFormState } from 'react-hook-form';
import Animated, { FadeIn } from 'react-native-reanimated';
import { match } from 'ts-pattern';

import { useFocusOnStepBack } from '../hooks/use-focus-on-step-back';
import { type SignUpFormValues } from '../schemas/sign-up-form.schema';
import { RevealedField } from './revealed-field';
import { SuggestedEmailDomainList } from './suggested-email-domain-list';

type UserInfoStep = 'name' | 'email';

const STEP_DESCRIPTION_KEYS = {
  name: 'auth:signUp.nameTitle',
  email: 'auth:signUp.emailTitle',
} as const satisfies Record<UserInfoStep, string>;

interface SignUpUserInfoFormProps {
  form: UseFormReturn<SignUpFormValues>;
  /** 이름 단계 다음 이메일 단계는 이름 칸 위에 이메일 칸을 더한다 */
  step: UserInfoStep;
  onNextStep: () => void;
}

export function SignUpUserInfoForm({ form, step, onNextStep }: SignUpUserInfoFormProps) {
  const { t } = useTranslation(['auth']);
  const { control } = form;
  const formState = useFormState({ control, name: ['name', 'email'] });
  const focusEmailInput = useCallback(() => {
    form.setFocus('email');
  }, [form]);

  useFocusOnStepBack({ step, firstStep: 'name', focus: () => form.setFocus('name') });

  const name = form.getFieldState('name', formState);
  const email = form.getFieldState('email', formState);
  const isNameReady = name.isDirty && !name.invalid;
  const isNextEnabled = match(step)
    .with('name', () => isNameReady)
    .with('email', () => isNameReady && email.isDirty && !email.invalid)
    .exhaustive();

  const submitStep = () => {
    if (isNextEnabled) {
      onNextStep();
    }
  };

  return (
    <Box className="flex-1">
      <FormStepLayout
        title={t(STEP_DESCRIPTION_KEYS[step])}
        footer={
          <KeyboardAdaptiveButton color="dark" onPress={submitStep} isDisabled={!isNextEnabled}>
            {t('auth:signUp.next')}
          </KeyboardAdaptiveButton>
        }
      >
        {step === 'email' && (
          <RevealedField onRevealed={focusEmailInput}>
            <Controller
              control={control}
              name="email"
              render={({ field: { ref, onChange, onBlur, value }, fieldState }) => {
                const error = fieldState.isTouched ? fieldState.error : undefined;
                return (
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
                      isInvalid={error != null}
                      errorMessage={resolveValidationMessage(error, {
                        default: 'email.invalid',
                        byType: { too_big: 'email.tooLong' },
                      })}
                      onSubmitEditing={submitStep}
                    />
                    <SuggestedEmailDomainList value={value} onChange={onChange} />
                  </VStack>
                );
              }}
            />
            <Spacing size={20} />
          </RevealedField>
        )}

        <Animated.View entering={FadeIn.duration(ANIMATION.duration.normal)}>
          <Controller
            control={control}
            name="name"
            render={({ field: { ref, onChange, onBlur, value }, fieldState }) => {
              const error = fieldState.isTouched ? fieldState.error : undefined;
              return (
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
                  isInvalid={error != null}
                  errorMessage={resolveValidationMessage(error, {
                    default: 'nickname.required',
                    byType: { too_big: 'nickname.tooLong' },
                  })}
                  onSubmitEditing={submitStep}
                />
              );
            }}
          />
        </Animated.View>
      </FormStepLayout>
    </Box>
  );
}
