import { emailSchema } from '@aido/validators';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { useStepper } from '@src/shared/hooks/useStepper';
import { useTranslation } from '@src/shared/i18n';
import { H3, Input, KeyboardAdaptiveButton, Spacing, VStack } from '@src/shared/ui';
import { useEffect, useRef } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { ScrollView, type TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { match } from 'ts-pattern';
import { type SignUpFormData, signUpFormSchema } from '../schemas/sign-up-form.schema';
import { SuggestedEmailDomainList } from './SuggestedEmailDomainList';

const USER_INFO_STEPS = ['name', 'email'] as const;

const STEP_DESCRIPTION_KEYS = {
  name: 'auth:signUp.nameTitle',
  email: 'auth:signUp.emailTitle',
} as const;

interface SignUpUserInfoFormProps {
  onNextStep: () => void;
}

export const SignUpUserInfoForm = ({ onNextStep }: SignUpUserInfoFormProps) => {
  const { t } = useTranslation(['auth']);
  const {
    control,
    formState: { errors },
  } = useFormContext<SignUpFormData>();
  const [email, name] = useWatch({ control, name: ['email', 'name'] });
  const { step, setStep } = useStepper<typeof USER_INFO_STEPS>(USER_INFO_STEPS);
  const emailInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (step !== 'email') return;

    const emailFocusTimeoutId = setTimeout(() => {
      emailInputRef.current?.focus();
    }, 300);

    return () => clearTimeout(emailFocusTimeoutId);
  }, [step]);

  const handleNext = () => {
    match(step)
      .with('name', () => {
        setStep('email');
      })
      .with('email', () => onNextStep())
      .exhaustive();
  };

  const isNameValid = signUpFormSchema.shape.name.safeParse(name).success;
  const isEmailValid = emailSchema.safeParse(email).success;

  const isNextButtonEnabled = match(step)
    .with('name', () => isNameValid)
    .with('email', () => isNameValid && isEmailValid)
    .exhaustive();

  return (
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
          <H3>{t(STEP_DESCRIPTION_KEYS[step])}</H3>
        </Animated.View>

        {step === 'email' && (
          <Animated.View
            entering={FadeInUp.duration(ANIMATION.duration.slow).delay(ANIMATION.delay.short)}
          >
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, value } }) => (
                <VStack gap={8}>
                  <Input
                    ref={emailInputRef}
                    label={t('auth:signUp.emailLabel')}
                    placeholder="example@email.com"
                    value={value}
                    onChangeText={onChange}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect={false}
                    submitBehavior="submit"
                    returnKeyType="next"
                    isInvalid={!!errors.email}
                    errorMessage={errors.email?.message}
                    onSubmitEditing={() => {
                      if (isEmailValid) handleNext();
                    }}
                  />
                  <SuggestedEmailDomainList<SignUpFormData> name="email" />
                </VStack>
              )}
            />
            <Spacing size={20} />
          </Animated.View>
        )}

        <Animated.View entering={FadeIn.duration(ANIMATION.duration.normal)}>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, value } }) => (
              <Input
                label={t('auth:signUp.nicknameLabel')}
                placeholder={t('auth:signUp.nicknamePlaceholder')}
                value={value}
                onChangeText={onChange}
                autoCapitalize="none"
                submitBehavior="submit"
                autoFocus={step === 'name'}
                returnKeyType="next"
                isInvalid={!!errors.name}
                errorMessage={errors.name?.message}
                onSubmitEditing={() => {
                  if (isNameValid) handleNext();
                }}
              />
            )}
          />
        </Animated.View>
      </ScrollView>

      <KeyboardAdaptiveButton color="dark" onPress={handleNext} isDisabled={!isNextButtonEnabled}>
        {t('auth:signUp.next')}
      </KeyboardAdaptiveButton>
    </View>
  );
};
