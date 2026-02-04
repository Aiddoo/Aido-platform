import { emailSchema } from '@aido/validators';
import { type SignUpFormData, signUpFormSchema } from '@src/features/auth/models/auth.model';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { useStepper } from '@src/shared/hooks/useStepper';
import { KeyboardAdaptiveButton } from '@src/shared/ui/Button';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { Input } from '@src/shared/ui/Input';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { H3 } from '@src/shared/ui/Text/Typography';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { Chip } from 'heroui-native';
import { useEffect, useRef } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { ScrollView, type TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { match } from 'ts-pattern';

const USER_INFO_STEPS = ['name', 'email'] as const;

const STEP_DESCRIPTIONS = {
  name: '반가워요!\n어떤 닉네임으로 불러드릴까요?',
  email: '로그인에 사용할\n이메일을 입력해주세요.',
} as const;

interface SignUpUserInfoFormProps {
  onNextStep: () => void;
}

export const SignUpUserInfoForm = ({ onNextStep }: SignUpUserInfoFormProps) => {
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
          <H3>{STEP_DESCRIPTIONS[step]}</H3>
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
                    label="이메일"
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
                  <SuggestedEmailDomainList />
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
                label="닉네임"
                placeholder="닉네임을 입력해주세요."
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
        다음
      </KeyboardAdaptiveButton>
    </View>
  );
};

const EMAIL_DOMAINS = [
  'gmail.com',
  'naver.com',
  'daum.net',
  'outlook.com',
  'icloud.com',
  'kakao.com',
] as const;
const MAX_SUGGESTED_DOMAINS = 3;

const SuggestedEmailDomainList = () => {
  const { setValue, control } = useFormContext<SignUpFormData>();
  const email = useWatch({ control, name: 'email' });

  const normalizedEmail = email ?? '';
  const [localPart, domainPart] = splitEmail(normalizedEmail);
  const suggestedDomains = getSuggestedDomains(normalizedEmail, domainPart);

  if (suggestedDomains.length === 0) {
    return null;
  }

  return (
    <Animated.View entering={FadeInUp.duration(ANIMATION.duration.normal).springify()}>
      <HStack gap={8} className="flex-wrap">
        {suggestedDomains.slice(0, MAX_SUGGESTED_DOMAINS).map((domain) => (
          <Chip
            key={domain}
            variant="soft"
            color="default"
            size="md"
            onPress={() => setValue('email', `${localPart}@${domain}`)}
          >
            <Chip.Label>@{domain}</Chip.Label>
          </Chip>
        ))}
      </HStack>
    </Animated.View>
  );
};

const splitEmail = (value: string): [string, string] => {
  const atIndex = value.lastIndexOf('@');
  if (atIndex === -1) {
    return [value, ''];
  }
  return [value.substring(0, atIndex), value.substring(atIndex + 1)];
};

const getSuggestedDomains = (rawEmail: string, domainPart: string) => {
  if (!rawEmail.includes('@')) {
    return [];
  }

  if (domainPart && EMAIL_DOMAINS.includes(domainPart as (typeof EMAIL_DOMAINS)[number])) {
    return [];
  }

  return EMAIL_DOMAINS.filter((domain) => domain.startsWith(domainPart));
};
