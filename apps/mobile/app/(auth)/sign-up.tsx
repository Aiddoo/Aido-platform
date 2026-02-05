import { zodResolver } from '@hookform/resolvers/zod';
import { SignUpPasswordForm } from '@src/features/auth/presentations/components/SignUpPasswordForm';
import { SignUpUserInfoForm } from '@src/features/auth/presentations/components/SignUpUserInfoForm';
import { SignUpVerificationForm } from '@src/features/auth/presentations/components/SignUpVerificationForm';
import {
  type SignUpFormData,
  signUpFormSchema,
} from '@src/features/auth/presentations/schemas/sign-up-form.schema';
import { useStepper } from '@src/shared/hooks/useStepper';
import { Stack } from 'expo-router';
import { FormProvider, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { match } from 'ts-pattern';

const SIGN_UP_STEPS = ['정보_입력', '비밀번호_설정', '이메일_인증'] as const;
type SignUpStep = (typeof SIGN_UP_STEPS)[number];

const SIGN_UP_STEP_TITLES = {
  정보_입력: '회원가입',
  비밀번호_설정: '비밀번호 설정',
  이메일_인증: '이메일 인증',
} as const satisfies Record<SignUpStep, string>;

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

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: SIGN_UP_STEP_TITLES[step] }} />

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
    </View>
  );
};

export default SignUpScreen;
