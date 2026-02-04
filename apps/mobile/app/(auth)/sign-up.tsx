import { zodResolver } from '@hookform/resolvers/zod';
import { type SignUpFormData, signUpFormSchema } from '@src/features/auth/models/auth.model';
import { SignUpPasswordForm } from '@src/features/auth/presentations/components/SignUpPasswordForm';
import { SignUpUserInfoForm } from '@src/features/auth/presentations/components/SignUpUserInfoForm';
import { SignUpVerificationForm } from '@src/features/auth/presentations/components/SignUpVerificationForm';
import { useStepper } from '@src/shared/hooks/useStepper';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { ArrowLeftIcon } from '@src/shared/ui/Icon';
import { StyledSafeAreaView } from '@src/shared/ui/SafeAreaView/SafeAreaView';
import { Text } from '@src/shared/ui/Text/Text';
import { router } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { FormProvider, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { match } from 'ts-pattern';

const SIGN_UP_STEPS = ['정보_입력', '비밀번호_설정', '이메일_인증'] as const;

const SignUpScreen = () => {
  const { step, setStep } = useStepper<typeof SIGN_UP_STEPS>(SIGN_UP_STEPS);

  const form = useForm<SignUpFormData>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: {
      email: '',
      password: '',
      passwordConfirm: '',
      name: '',
    },
    mode: 'onTouched',
  });

  const getHeaderTitle = () => {
    return match(step)
      .with('정보_입력', () => '회원가입')
      .with('비밀번호_설정', () => '비밀번호 설정')
      .with('이메일_인증', () => '이메일 인증')
      .exhaustive();
  };

  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['top']}>
      <HStack align="center" px={16} py={12}>
        <PressableFeedback onPress={() => router.back()}>
          <ArrowLeftIcon width={24} height={24} colorClassName="text-gray-8" />
        </PressableFeedback>
        <Text size="b2" weight="semibold" align="center" className="flex-1">
          {getHeaderTitle()}
        </Text>
        <View className="w-6" />
      </HStack>

      <FormProvider {...form}>
        {match(step)
          .with('정보_입력', () => (
            <SignUpUserInfoForm onNextStep={() => setStep('비밀번호_설정')} />
          ))
          .with('비밀번호_설정', () => (
            <SignUpPasswordForm onNextStep={() => setStep('이메일_인증')} />
          ))
          .with('이메일_인증', () => <SignUpVerificationForm />)
          .exhaustive()}
      </FormProvider>
    </StyledSafeAreaView>
  );
};

export default SignUpScreen;
