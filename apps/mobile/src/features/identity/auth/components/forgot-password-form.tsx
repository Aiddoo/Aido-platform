import { zodResolver } from '@hookform/resolvers/zod';
import { useTrack } from '@src/shared/analytics';
import { ANIMATION } from '@src/shared/constants/animation';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useStepper } from '@src/shared/hooks/use-stepper';
import { useTranslation } from '@src/shared/i18n';
import { resolveValidationMessage } from '@src/shared/i18n/validation-message';
import { Input, KeyboardAdaptiveButton, VStack, FormStepLayout, Box } from '@src/shared/ui';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  Controller,
  useController,
  useForm,
  type UseFormReturn,
  useFormState,
} from 'react-hook-form';
import Animated, { FadeIn } from 'react-native-reanimated';

import { findVerificationCodeFieldError } from '../domains/auth.error';
import {
  useForgotPasswordMutationOptions,
  useResetPasswordMutationOptions,
} from '../queries/auth.mutations';
import {
  type ForgotPasswordFormValues,
  forgotPasswordFormSchema,
} from '../schemas/forgot-password-form.schema';
import { EmailVerificationCodeStep } from './email-verification-code-step';
import { NewPasswordStep } from './new-password-step';
import { SuggestedEmailDomainList } from './suggested-email-domain-list';

type ForgotPasswordStepContexts = {
  email: Record<string, never>;
  verificationCode: { email: string };
  newPassword: Record<string, never>;
  newPasswordConfirm: Record<string, never>;
};

interface ForgotPasswordFormProps {
  /** 인증 코드 단계는 받은 이메일을 보여 줘서 제목을 그 단계가 맡는다 */
  stepTitles: Record<'email' | 'newPassword', string>;
}

/** 인증 코드 재발송 쿨다운은 인증 단계가 맡는다 */
export function ForgotPasswordForm({ stepTitles }: ForgotPasswordFormProps) {
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
  const { trackEvent } = useTrack();
  const stepper = useStepper<ForgotPasswordStepContexts>({
    id: 'forgot-password',
    initial: { step: 'email' },
    onStepChange: ({ step }) => trackEvent('auth_password_reset_step_viewed', { step }),
  });
  const forgotPassword = useMutation(useForgotPasswordMutationOptions());
  const resetPassword = useMutation(useResetPasswordMutationOptions());
  const { t } = useTranslation('auth');
  const newPassword = useController({
    control: form.control,
    name: 'newPassword',
    // 새 비밀번호를 고치면 이미 적은 확인 칸의 일치 여부도 다시 본다
    rules: { deps: 'newPasswordConfirm' },
  });
  const newPasswordConfirm = useController({ control: form.control, name: 'newPasswordConfirm' });
  const { isSubmitting, errors } = useFormState({ control: form.control });
  const replace = useSingleTap(router.replace);

  const requestCode = async () => {
    try {
      const email = form.getValues('email');
      await forgotPassword.mutateAsync({ email });
      stepper.history.push('verificationCode', { email });
    } catch {
      // 실패 안내와 보고는 mutation의 meta.errorFeedback이 맡는다
    }
  };

  // 코드는 마지막에 서버가 확인한다. 틀렸거나 만료됐으면 새 비밀번호를 둔 채 코드 단계로 돌아가 다시 받게 한다
  const submitNewPassword = form.handleSubmit(async (input) => {
    try {
      await resetPassword.mutateAsync(input);
      replace('/(auth)/email-login');
    } catch (error) {
      // 문구는 mutation의 meta.errorFeedback이 카탈로그로 보인다
      const fieldError = findVerificationCodeFieldError(error);
      const codeStepIndex = stepper.historySteps.findIndex(
        (entry) => entry.step === 'verificationCode',
      );
      if (fieldError != null && 0 <= codeStepIndex) {
        form.setError('code', fieldError);
        stepper.history.go(codeStepIndex - stepper.index);
      }
    }
  });

  const renderNewPassword = ({ step }: { step: 'newPassword' | 'newPasswordConfirm' }) => (
    <NewPasswordStep
      title={stepTitles.newPassword}
      step={step}
      newPassword={newPassword}
      newPasswordConfirm={newPasswordConfirm}
      isSubmitting={isSubmitting || resetPassword.isPending}
      onNextStep={() => stepper.history.push('newPasswordConfirm')}
      onSubmit={submitNewPassword}
      nextLabel={t('forgotPassword.next')}
      submitLabel={t('forgotPassword.submit')}
    />
  );

  return (
    <stepper.Render
      email={() => (
        <EmailStep
          title={stepTitles.email}
          form={form}
          onSubmit={requestCode}
          isSubmitting={forgotPassword.isPending}
        />
      )}
      verificationCode={({ context: { email }, history }) => (
        <EmailVerificationCodeStep
          email={email}
          isRejected={errors.code != null}
          isResending={forgotPassword.isPending}
          onComplete={async (code) => {
            form.setValue('code', code, { shouldValidate: true });
            history.push('newPassword');
          }}
          onResend={async () => {
            await forgotPassword.mutateAsync({ email });
            return { retryAfterSeconds: null };
          }}
        />
      )}
      newPassword={renderNewPassword}
      newPasswordConfirm={renderNewPassword}
    />
  );
}

interface EmailStepProps {
  title: string;
  form: UseFormReturn<ForgotPasswordFormValues>;
  onSubmit: () => Promise<unknown>;
  isSubmitting: boolean;
}

function EmailStep({ title, form, onSubmit, isSubmitting }: EmailStepProps) {
  const { t } = useTranslation('auth');
  const { control } = form;
  const formState = useFormState({ control, name: 'email' });
  const email = form.getFieldState('email', formState);
  const isValid = email.isDirty && !email.invalid;

  return (
    <Box className="flex-1">
      <FormStepLayout
        title={title}
        footer={
          <KeyboardAdaptiveButton onPress={onSubmit} isDisabled={!isValid} isLoading={isSubmitting}>
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
                    isInvalid={!!error}
                    errorMessage={resolveValidationMessage(error, {
                      default: 'email.invalid',
                      byType: { too_big: 'email.tooLong' },
                    })}
                    onSubmitEditing={() => {
                      if (isValid && !isSubmitting) {
                        onSubmit();
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
