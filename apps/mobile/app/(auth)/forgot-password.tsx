import { zodResolver } from '@hookform/resolvers/zod';
import { EmailVerificationCodeStep } from '@src/features/identity/auth/components/email-verification-code-step';
import { NewPasswordStep } from '@src/features/identity/auth/components/new-password-step';
import { SuggestedEmailDomainList } from '@src/features/identity/auth/components/suggested-email-domain-list';
import { findVerificationCodeFieldError } from '@src/features/identity/auth/domains/auth.error';
import {
  useForgotPasswordMutationOptions,
  useResetPasswordMutationOptions,
} from '@src/features/identity/auth/queries/auth.mutations';
import {
  type ForgotPasswordFormValues,
  forgotPasswordFormSchema,
} from '@src/features/identity/auth/schemas/forgot-password-form.schema';
import { useTrack } from '@src/shared/analytics';
import { ANIMATION } from '@src/shared/constants/animation';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useStepper } from '@src/shared/hooks/use-stepper';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import {
  Box,
  FormStepLayout,
  Input,
  KeyboardAdaptiveButton,
  ReadableContent,
  VStack,
} from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { noop } from 'es-toolkit';
import { useNavigation, useRouter } from 'expo-router';
import {
  Controller,
  useController,
  useForm,
  type UseFormReturn,
  useFormState,
} from 'react-hook-form';
import Animated, { FadeIn } from 'react-native-reanimated';

type ForgotPasswordStepContexts = {
  email: Record<string, never>;
  verificationCode: { email: string };
  newPassword: Record<string, never>;
  newPasswordConfirm: Record<string, never>;
};

type NewPasswordStepName = 'newPassword' | 'newPasswordConfirm';
type ForgotPasswordForm = UseFormReturn<ForgotPasswordFormValues>;

/** 인증 코드 재발송 쿨다운은 인증 단계가 맡는다 */
export default function ForgotPasswordScreen() {
  const { trackEvent } = useTrack();
  const router = useRouter();
  const navigation = useNavigation();
  const replace = useSingleTap(router.replace);
  const stepper = useStepper<ForgotPasswordStepContexts>({
    id: 'forgot-password',
    initial: { step: 'email' },
    onStepChange: ({ step }) => trackEvent('auth_password_reset_step_viewed', { step }),
  });
  // 칸은 단계 컴포넌트가 구독해 글자를 쳐도 여기는 다시 그려지지 않는다
  const form = useForm({
    resolver: zodResolver(forgotPasswordFormSchema),
    defaultValues: {
      email: '',
      code: '',
      newPassword: '',
      newPasswordConfirm: '',
    },
    mode: 'onChange',
  });
  // 이메일 단계의 요청과 코드 단계의 다시 보내기가 한 요청이라, 다시 보내는 중에 뒤로 와도 다음 버튼이 기다린다
  const forgotPassword = useMutation(useForgotPasswordMutationOptions());
  const requestCode = (email: string) => forgotPassword.mutateAsync({ email });

  // 재설정을 기다리는 사이 떠났으면 보던 화면을 바꾸지 않고, 돌아와 다시 쓸 수 있게 값·단계는 둔 채 제출 상태만 푼다
  const leaveToLogin = () => {
    if (navigation.isFocused()) {
      replace('/(auth)/email-login');
      return;
    }
    form.reset(form.getValues(), { keepDefaultValues: true });
  };

  const renderNewPassword = ({ step }: { step: NewPasswordStepName }) => (
    <ResetPasswordStep
      form={form}
      step={step}
      onNext={() => stepper.history.push('newPasswordConfirm')}
      onDone={leaveToLogin}
      onCodeRejected={() => stepper.history.backTo('verificationCode')}
    />
  );

  return (
    <Box className="flex-1 bg-white">
      <ReadableContent flex={1}>
        <stepper.Render
          email={({ history }) => (
            <EmailStep
              form={form}
              isRequesting={forgotPassword.isPending}
              onRequestCode={requestCode}
              onNext={(email) => history.push('verificationCode', { email })}
            />
          )}
          verificationCode={({ context: { email }, history }) => (
            <VerificationCodeStep
              form={form}
              email={email}
              isResending={forgotPassword.isPending}
              onResend={() => requestCode(email)}
              onNext={() => history.push('newPassword')}
            />
          )}
          newPassword={renderNewPassword}
          newPasswordConfirm={renderNewPassword}
        />
      </ReadableContent>
    </Box>
  );
}

interface EmailStepProps {
  form: ForgotPasswordForm;
  isRequesting: boolean;
  onRequestCode: (email: string) => Promise<unknown>;
  onNext: (email: string) => void;
}

function EmailStep({ form, isRequesting, onRequestCode, onNext }: EmailStepProps) {
  const { t } = useTranslation('auth');
  const { control } = form;
  const formState = useFormState({ control, name: 'email' });

  const email = form.getFieldState('email', formState);
  const isValid = email.isDirty && !email.invalid;
  const isSubmitting = isRequesting;

  // 실패 안내와 보고는 mutation의 meta.errorFeedback이 맡는다. 이메일 단계에 머물러 적은 주소를 지킨다.
  // 같은 프레임의 두 번째 탭은 요청 중 표시가 다음 렌더에야 켜져 여기서 막는다
  const requestCode = useSingleTap(() => {
    const emailValue = form.getValues('email');
    onRequestCode(emailValue)
      .then(() => onNext(emailValue))
      .catch(noop);
  });

  return (
    <Box className="flex-1">
      <FormStepLayout
        title={t('forgotPassword.emailTitle')}
        footer={
          <KeyboardAdaptiveButton
            onPress={requestCode}
            isDisabled={!isValid}
            isLoading={isSubmitting}
          >
            {t('forgotPassword.next')}
          </KeyboardAdaptiveButton>
        }
      >
        <Animated.View entering={FadeIn.duration(ANIMATION.durationMs.normal)}>
          <VStack gap={8}>
            <Controller
              control={control}
              name="email"
              render={({ field: { ref, onChange, onBlur, value }, fieldState: { error } }) => (
                <VStack gap={8}>
                  <Input
                    ref={ref}
                    placeholder={t('forgotPassword.emailPlaceholder')}
                    value={value}
                    onChange={onChange}
                    onBlur={onBlur}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    returnKeyType="done"
                    submitBehavior="submit"
                    isInvalid={error != null}
                    errorMessage={resolveValidationMessage(error, {
                      default: 'email.invalid',
                      byType: { too_big: 'email.tooLong' },
                    })}
                    onSubmitEditing={() => {
                      if (isValid && !isSubmitting) {
                        requestCode();
                      }
                    }}
                  />
                  <SuggestedEmailDomainList value={value} onChange={onChange} />
                </VStack>
              )}
            />
          </VStack>
        </Animated.View>
      </FormStepLayout>
    </Box>
  );
}

interface VerificationCodeStepProps {
  form: ForgotPasswordForm;
  email: string;
  isResending: boolean;
  onResend: () => Promise<unknown>;
  onNext: () => void;
}

// 코드는 마지막에 서버가 확인한다. 여기서는 받아 두고 새 비밀번호 단계로 간다
function VerificationCodeStep({
  form,
  email,
  isResending,
  onResend,
  onNext,
}: VerificationCodeStepProps) {
  const { errors } = useFormState({ control: form.control, name: 'code' });

  return (
    <EmailVerificationCodeStep
      email={email}
      isRejected={errors.code != null}
      isResending={isResending}
      onComplete={async (code) => {
        form.setValue('code', code, { shouldValidate: true });
        onNext();
      }}
      onResend={async () => {
        await onResend();
        return { retryAfterSeconds: null };
      }}
    />
  );
}

interface ResetPasswordStepProps {
  form: ForgotPasswordForm;
  /** 새 비밀번호 단계 다음 확인 단계는 새 비밀번호 칸 위에 확인 칸을 더한다 */
  step: NewPasswordStepName;
  onNext: () => void;
  onDone: () => void;
  /** 코드가 틀렸거나 만료됐다. 새 비밀번호를 둔 채 코드 단계로 돌아가 다시 받게 한다 */
  onCodeRejected: () => void;
}

function ResetPasswordStep({ form, step, onNext, onDone, onCodeRejected }: ResetPasswordStepProps) {
  const { t } = useTranslation('auth');
  const resetPassword = useMutation(useResetPasswordMutationOptions());
  const newPassword = useController({
    control: form.control,
    name: 'newPassword',
    // 새 비밀번호를 고치면 이미 적은 확인 칸의 일치 여부도 다시 본다
    rules: { deps: 'newPasswordConfirm' },
  });
  const newPasswordConfirm = useController({ control: form.control, name: 'newPasswordConfirm' });
  const { isSubmitting, isSubmitSuccessful } = useFormState({ control: form.control });

  const saveNewPassword = form.handleSubmit(async (input) => {
    await resetPassword.mutateAsync(input);
    onDone();
  });

  // 문구는 mutation의 meta.errorFeedback이 카탈로그로 보인다. 코드가 거절되면 그 칸에 남긴다
  const handleResetError = (error: unknown) => {
    const fieldError = findVerificationCodeFieldError(error);
    if (fieldError != null) {
      form.setError('code', fieldError);
      onCodeRejected();
    }
  };
  // 같은 프레임의 두 번째 탭은 isSubmitting이 다음 렌더에야 켜져 여기서 막는다
  const handleSavePress = useSingleTap(() => {
    saveNewPassword().catch(handleResetError);
  });

  return (
    <NewPasswordStep
      title={t('forgotPassword.newPasswordTitle')}
      step={step}
      newPassword={{
        value: newPassword.field.value,
        onChange: newPassword.field.onChange,
        isDirty: newPassword.fieldState.isDirty,
        isInvalid: newPassword.fieldState.invalid,
      }}
      newPasswordConfirm={{
        value: newPasswordConfirm.field.value,
        onChange: newPasswordConfirm.field.onChange,
        isDirty: newPasswordConfirm.fieldState.isDirty,
        isInvalid: newPasswordConfirm.fieldState.invalid,
        errorMessage: resolveValidationMessage(newPasswordConfirm.fieldState.error, {
          default: 'password.mismatch',
        }),
      }}
      // 재설정하면 로그인으로 바뀌는 동안에도 같은 값이 남는다. 다시 보내면 쓴 코드라 거절된다
      isSubmitting={isSubmitting || isSubmitSuccessful || resetPassword.isPending}
      onNext={onNext}
      onSubmit={handleSavePress}
      nextLabel={t('forgotPassword.next')}
      submitLabel={t('forgotPassword.submit')}
    />
  );
}
