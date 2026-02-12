import { PASSWORD_RULES, passwordSchema } from '@aido/validators';
import { ANIMATION } from '@src/shared/constants/animation.constants';
import { useStepper } from '@src/shared/hooks/useStepper';
import { KeyboardAdaptiveButton } from '@src/shared/ui/Button';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { CheckmarkIcon, EyeIcon, EyeOffIcon } from '@src/shared/ui/Icon/icons';
import { Input } from '@src/shared/ui/Input';
import { Text } from '@src/shared/ui/Text/Text';
import { H3 } from '@src/shared/ui/Text/Typography';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useEffect, useRef, useState } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { Keyboard, Pressable, ScrollView, type TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { match } from 'ts-pattern';
import type { SignUpFormData } from '../schemas/sign-up-form.schema';
import { TermsBottomSheet } from './TermsBottomSheet';

const PASSWORD_STEPS = ['password', 'passwordConfirm'] as const;

interface SignUpPasswordFormProps {
  onNextStep: () => void;
}

export const SignUpPasswordForm = ({ onNextStep }: SignUpPasswordFormProps) => {
  const {
    control,
    formState: { errors },
  } = useFormContext<SignUpFormData>();
  const [password, passwordConfirm] = useWatch({ control, name: ['password', 'passwordConfirm'] });
  const { step, setStep } = useStepper(PASSWORD_STEPS);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const passwordConfirmInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (step !== 'passwordConfirm') return;

    const passwordConfirmFocusTimeoutId = setTimeout(() => {
      passwordConfirmInputRef.current?.focus();
    }, 350);

    return () => clearTimeout(passwordConfirmFocusTimeoutId);
  }, [step]);

  const isPasswordValid = passwordSchema.safeParse(password).success;
  const isPasswordConfirmValid = isPasswordValid && password === passwordConfirm;

  const hasMinLength = (password?.length ?? 0) >= PASSWORD_RULES.MIN_LENGTH;
  const hasLetter = PASSWORD_RULES.HAS_LETTER.test(password || '');
  const hasNumber = PASSWORD_RULES.HAS_NUMBER.test(password || '');

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
            <H3>{`영문 숫자를 포함한\n비밀번호를 설정해주세요`}</H3>
          </Animated.View>

          {step === 'passwordConfirm' && (
            <Animated.View
              entering={FadeInUp.duration(ANIMATION.duration.slow).delay(ANIMATION.delay.short)}
            >
              <VStack mb={20}>
                <Controller
                  control={control}
                  name="passwordConfirm"
                  render={({ field: { onChange, value } }) => (
                    <Input
                      ref={passwordConfirmInputRef}
                      label="비밀번호 확인"
                      placeholder="비밀번호를 다시 입력해주세요"
                      value={value}
                      onChangeText={onChange}
                      secureTextEntry={!showPasswordConfirm}
                      returnKeyType="done"
                      isInvalid={!!errors.passwordConfirm}
                      errorMessage={errors.passwordConfirm?.message}
                      onSubmitEditing={() => {
                        if (isPasswordConfirmValid) handleNext();
                      }}
                      rightContent={
                        <Pressable onPress={() => setShowPasswordConfirm(!showPasswordConfirm)}>
                          {showPasswordConfirm ? (
                            <EyeOffIcon colorClassName="text-gray-5" />
                          ) : (
                            <EyeIcon colorClassName="text-gray-5" />
                          )}
                        </Pressable>
                      }
                    />
                  )}
                />
              </VStack>
            </Animated.View>
          )}

          <Animated.View entering={FadeIn.duration(ANIMATION.duration.normal)}>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, value } }) => (
                <VStack gap={8}>
                  <Input
                    label="비밀번호"
                    placeholder="비밀번호를 입력해주세요"
                    value={value}
                    onChangeText={onChange}
                    secureTextEntry={!showPassword}
                    autoFocus={step === 'password'}
                    submitBehavior="submit"
                    returnKeyType="next"
                    isInvalid={!!errors.password}
                    errorMessage={errors.password?.message}
                    onSubmitEditing={() => {
                      if (isPasswordValid) handleNext();
                    }}
                    rightContent={
                      <Pressable onPress={() => setShowPassword(!showPassword)}>
                        {showPassword ? (
                          <EyeOffIcon colorClassName="text-gray-5" />
                        ) : (
                          <EyeIcon colorClassName="text-gray-5" />
                        )}
                      </Pressable>
                    }
                  />

                  <HStack gap={16} className="items-center">
                    <PasswordRuleItem isSatisfied={hasLetter} label="영문 포함" />
                    <PasswordRuleItem isSatisfied={hasNumber} label="숫자 포함" />
                    <PasswordRuleItem isSatisfied={hasMinLength} label="8자 이상" />
                  </HStack>
                </VStack>
              )}
            />
          </Animated.View>
        </ScrollView>

        <KeyboardAdaptiveButton
          color="dark"
          onPress={handleNext}
          isDisabled={!isNextEnabled}
          enabled={!isTermsOpen}
        >
          다음
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

interface PasswordRuleItemProps {
  isSatisfied: boolean;
  label: string;
}

const PasswordRuleItem = ({ isSatisfied, label }: PasswordRuleItemProps) => {
  const colorClassName = isSatisfied ? 'text-success' : 'text-gray-5';

  return (
    <HStack gap={4} className="items-center">
      <CheckmarkIcon colorClassName={colorClassName} width={14} height={14} />
      <Text className={colorClassName} size="b4">
        {label}
      </Text>
    </HStack>
  );
};
