import { zodResolver } from '@hookform/resolvers/zod';
import { SignUpPasswordForm } from '@src/features/auth/presentations/components/SignUpPasswordForm';
import { SignUpUserInfoForm } from '@src/features/auth/presentations/components/SignUpUserInfoForm';
import { SignUpVerificationForm } from '@src/features/auth/presentations/components/SignUpVerificationForm';
import {
  type SignUpFormData,
  signUpFormSchema,
} from '@src/features/auth/presentations/schemas/sign-up-form.schema';
import { useStepper } from '@src/shared/hooks/useStepper';
import { useTranslation } from '@src/shared/i18n';
import { Stack } from 'expo-router';
import { FormProvider, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { match } from 'ts-pattern';

const SIGN_UP_STEPS = ['userInfo', 'password', 'verification'] as const;
type SignUpStep = (typeof SIGN_UP_STEPS)[number];

const SIGN_UP_STEP_TITLE_KEYS = {
  userInfo: 'auth:signUp.title',
  password: 'auth:signUp.passwordStepTitle',
  verification: 'auth:signUp.verificationStepTitle',
} as const satisfies Record<SignUpStep, string>;

const SignUpScreen = () => {
  const { t } = useTranslation(['auth']);
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
      <Stack.Screen options={{ title: t(SIGN_UP_STEP_TITLE_KEYS[step]) }} />

      <FormProvider {...form}>
        {match(step)
          .with('userInfo', () => <SignUpUserInfoForm onNextStep={() => setStep('password')} />)
          .with('password', () => <SignUpPasswordForm onNextStep={() => setStep('verification')} />)
          .with('verification', () => <SignUpVerificationForm />)
          .exhaustive()}
      </FormProvider>
    </View>
  );
};

export default SignUpScreen;
