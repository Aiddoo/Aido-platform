import { zodResolver } from '@hookform/resolvers/zod';
import { useHaptics } from '@src/bootstrap/providers/di-context';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { type Stepper } from '@src/shared/hooks/use-stepper';
import { useTranslation } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useForm } from 'react-hook-form';

import { toRegisterRequest } from '../../apis/auth.mapper';
import { isEmailAlreadyRegisteredError } from '../../domains/auth.error';
import {
  useRegisterMutationOptions,
  useResendVerificationMutationOptions,
  useVerifyEmailMutationOptions,
} from '../../queries/auth.mutations';
import { signUpFormSchema, type SignUpFormValues } from '../../schemas/sign-up-form.schema';
import { EmailVerificationCodeStep } from '../email-verification-code-step';
import { SignUpPasswordForm } from './sign-up-password-form';
import { SignUpUserInfoForm } from './sign-up-user-info-form';

/** 이름·이메일, 비밀번호·확인은 칸이 하나씩 늘어나는 한 화면이라 같은 렌더러로 이어 그린다 */
export type SignUpStepContexts = {
  name: Record<string, never>;
  email: Record<string, never>;
  password: Record<string, never>;
  passwordConfirm: Record<string, never>;
  verification: { email: string };
};

type SignUpStep = keyof SignUpStepContexts;

/** 입력 단계의 이름은 그 단계에서 새로 여는 칸 이름과 같다 */
const FIELD_STEPS = [
  'name',
  'email',
  'password',
  'passwordConfirm',
] as const satisfies readonly (SignUpStep & keyof SignUpFormValues)[];

interface SignUpFormProps {
  /** 제목과 툴바가 단계를 따라가므로 단계 이동은 화면이 소유하고 여기서는 읽고 옮기기만 한다 */
  stepper: Stepper<SignUpStepContexts>;
}

/** 앞 단계로 돌아가도 입력값은 폼이 지킨다 */
export function SignUpForm({ stepper }: SignUpFormProps) {
  const form = useForm({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: {
      email: '',
      termsAgreed: false,
      privacyAgreed: false,
      isMarketingAgreed: false,
      password: '',
      passwordConfirm: '',
      name: '',
    },
    // 단계 버튼이 칸의 유효성을 바로 따르도록 입력마다 검사한다. 오류 문구는 칸을 벗어난 뒤에 보인다
    mode: 'onChange',
  });

  const { t } = useTranslation('auth');
  const haptics = useHaptics();
  const toast = useAppToast();
  const goToLogin = useSingleTap(() => router.replace('/(auth)/email-login'));
  const register = useMutation(useRegisterMutationOptions());
  const verify = useMutation(useVerifyEmailMutationOptions());
  const resend = useMutation(useResendVerificationMutationOptions());

  const goBackTo = (step: SignUpStep) => {
    const index = stepper.historySteps.findIndex((entry) => entry.step === step);
    if (0 <= index && index !== stepper.index) {
      stepper.history.go(index - stepper.index);
    }
  };

  const findInvalidStep = async () => {
    await form.trigger(FIELD_STEPS);
    return FIELD_STEPS.find((step) => form.getFieldState(step).invalid) ?? null;
  };

  // 가입 요청이 실패하면 false를 돌려 약관 시트를 열어 둔다. 바로 다시 누를 수 있다
  const submitValidRegister = () =>
    new Promise<boolean>((resolve) => {
      form.handleSubmit(
        async ({ termsAgreed, privacyAgreed, ...values }) => {
          // 스키마가 이미 막았다. 요청 타입이 true만 받아 여기서 좁힌다
          if (!termsAgreed || !privacyAgreed) {
            resolve(false);
            return;
          }

          try {
            await register.mutateAsync(
              toRegisterRequest({ ...values, termsAgreed, privacyAgreed }),
            );
            stepper.history.replace('verification', { email: values.email });
            resolve(true);
          } catch (error) {
            if (isEmailAlreadyRegisteredError(error)) {
              haptics.notify('error');
              toast.error(t('toasts.alreadyRegistered'), {
                action: { label: t('toasts.goToLogin'), onPress: goToLogin },
              });
            }
            resolve(false);
          }
        },
        () => resolve(false),
      )();
    });

  // 단계 버튼이 앞 칸을 이미 막았다. 그 사이 값이 바뀌었으면 틀린 칸의 단계로 돌아간다
  const submitRegister = async () => {
    const invalidStep = await findInvalidStep();
    if (invalidStep != null) {
      goBackTo(invalidStep);
      return false;
    }
    return submitValidRegister();
  };

  const renderUserInfo = ({ step }: { step: 'name' | 'email' }) => (
    <SignUpUserInfoForm
      form={form}
      step={step}
      onNextStep={() => stepper.history.push(step === 'name' ? 'email' : 'password')}
    />
  );

  const renderPassword = ({ step }: { step: 'password' | 'passwordConfirm' }) => (
    <SignUpPasswordForm
      form={form}
      step={step}
      onNextStep={() => stepper.history.push('passwordConfirm')}
      onSubmit={submitRegister}
    />
  );

  return (
    <stepper.Render
      name={renderUserInfo}
      email={renderUserInfo}
      password={renderPassword}
      passwordConfirm={renderPassword}
      verification={({ context: { email } }) => (
        <EmailVerificationCodeStep
          email={email}
          isVerifying={verify.isPending}
          isResending={resend.isPending}
          onComplete={(code) => verify.mutateAsync({ email, code, source: 'sign_up' })}
          onResend={() => resend.mutateAsync({ email, source: 'sign_up' })}
        />
      )}
    />
  );
}
